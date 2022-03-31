import React, { useContext, useEffect, useState } from "react"
import { BigNumber, providers, utils } from "ethers"
import WalletConnectProvider from "@walletconnect/web3-provider"
import useLocalStorage from "@rehooks/local-storage"
import promiseTimeout from "./functions/promiseTimeout"
import ReactDOM from "react-dom"
import { JsonRpcProvider } from "@ethersproject/providers"

function getMetaMask(): Record<string, any> | undefined {
  if(typeof window !== "undefined") {
    // @ts-ignore
    return window["ethereum"] as Record<string, any> || undefined
  } else {
    return undefined
  }
}

export function getIsMetaMaskAvailable() {
  return !!getMetaMask()
}

type WalletInfo = { img?: string, name?: string, web?: string }
type Wallet = ["disconnected", {
  connectWalletConnect: () => Promise<WalletConnectProvider | null>
  connectMetaMask: (() => Promise<any>) | null
}] | ["connected", {
  provider: providers.Web3Provider
  account: string
  targetChainBalance: { value: BigNumber, refresh: () => Promise<BigNumber> }
  disconnect: () => Promise<void>
  walletInfo: WalletInfo
  currentChainId?: number
  requestSwitchToCorrectChain?: () => Promise<void>
}]

const defaultEmptyContext: Wallet = ["disconnected", {
  connectWalletConnect: () => new Promise(() => null),
  connectMetaMask: null,
}]


export const WalletContext = React.createContext<Wallet>(defaultEmptyContext)

export default function AdamsWalletProvider({ children, chainId, rpcAddress, chainInfo }: { children: React.ReactNode, chainId: number, rpcAddress: string, chainInfo?: { name: string, decimals: number, symbol: string } }) {
  const [provider, setProvider] = useState<providers.Web3Provider | undefined>()
  const [account, setAccount] = useState<string | undefined>()
  const [currentChainId, setCurrentchainId] = useState<number>()
  const [balance, setBalance] = useState<BigNumber>(BigNumber.from(0))
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({})
  const [disconnectedMetamask, setDisconnectedMetamask] = useLocalStorage("disconnectMetamask", false)

  function _createWalletConnectProvider() {
    return new WalletConnectProvider({
      chainId,
      rpc: {
        1: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
        4: "https://rinkeby.infura.io/v3/",
        56: "https://bsc-dataseed.binance.org/",
        137: "https://polygon-rpc.com/",
        // [chainId]: rpcAddress,
      },
    })
  }

  async function getBalance(address: string) {
    // this solution gets you the balance of the target chain, event if the wallet is currently on a different chain
    const jsonRpcProvider = new JsonRpcProvider(rpcAddress)
    return await jsonRpcProvider.getBalance(address)
  }

  async function refreshBalance() {
    if (!provider || !account) {
      throw new Error("Unexpected state occured")
    }
    const bal = await getBalance(account)
    console.log({bal})
    setBalance(bal)
    return bal
  }

  async function connectWalletConnect() {
    const walletConnect = _createWalletConnectProvider()
    walletConnect["removeAllListeners"]()
    
    try {
      const web3Provider = new providers.Web3Provider(walletConnect)
      const accounts = await walletConnect.enable()

      walletConnect.on("accountsChanged", async (accounts: string[]) => {
        walletConnect["removeAllListeners"]()
        // we're just reconnecting on account / chain change, because it's simpler, no need to worry about updating each state var separately
        // without the timeout, walletConnect.chainId didn't catch the change (polygon -> ethereum on rainbow wallet)
        setTimeout(connectWalletConnect, 0)
      })

      walletConnect.on("chainChanged", (chainId: number) => {
        walletConnect["removeAllListeners"]()
        // without the timeout, walletConnect.chainId didn't catch the change (polygon -> ethereum on rainbow wallet)
        setTimeout(connectWalletConnect, 0)
      })
      
      walletConnect.on("disconnect", (kk: any) => {
        console.log("diss", kk)
        onDisconnect()
      })

      walletConnect.on("session_update", (error: any, payload: any) => {
        console.log("session_update", error, payload)
      });

      walletConnect.on("changed", (...args: any[]) => {
        console.log("changed", args)
      });


      // INFO - we are calling this to check whether the WalletConnect connection still exists.
      const request = walletConnect.request({
        method: 'eth_accounts',
      });

      await promiseTimeout(request, 3000)

      // console.log(res, accounts, walletConnect, Object.getOwnPropertyNames(walletConnect));

      const bal = await getBalance(accounts[0])
      ReactDOM.unstable_batchedUpdates(() => {
        if (accounts.length) {
          setAccount(accounts[0])
        }
        setBalance(bal)
        setCurrentchainId(walletConnect.chainId)
        setWalletInfo({ name: walletConnect.walletMeta?.name, img: walletConnect.walletMeta?.icons.length ? walletConnect.walletMeta?.icons[0] : undefined, web: walletConnect.walletMeta?.url })
        setProvider(web3Provider)
    })

    } catch (e) {
      setProvider(undefined)
      onDisconnect()
      console.log(JSON.stringify(e))
      console.error(e)
    }

    return walletConnect
  }

  console.log("refresh")
  const connectMetaMask = getIsMetaMaskAvailable()
    ? async () => {
        const ethereum = getMetaMask()!
        if (ethereum) {
          ethereum.removeAllListeners()
          const web3Provider = new providers.Web3Provider(ethereum)

          
          try {
            const accounts = web3Provider.provider.request ? await (web3Provider.provider.request({ method: 'eth_requestAccounts' }) as Promise<string[]>) : [] as string[]

            ethereum.on("chainChanged", (chainIdHex: string) => {
              // MetaMask recommends reloading the page, but I think reconnecting should be enough, I don't remember what the problem is anyway
              !disconnectedMetamask && connectMetaMask && connectMetaMask()
            })

            ethereum.on("accountsChanged", async (accounts: string[]) => {
              // setBalance(await web3Provider.getBalance(accounts[0]))
              !disconnectedMetamask && connectMetaMask && connectMetaMask()
            })

            web3Provider.on("disconnect", () => {
              onDisconnect()
            })

            // await requestSwitchToCorrectChain(web3Provider)

            const bal = await getBalance(accounts[0])

            ReactDOM.unstable_batchedUpdates(() => {
              if (accounts.length) {
                setAccount(accounts[0])
              }
              setDisconnectedMetamask(false)
              setCurrentchainId(Number(ethereum.chainId))
              setBalance(bal)
              setProvider(web3Provider)
            })
          } catch {}

          return ethereum
        }
      }
    : null

  useEffect(() => {
    function cb() {
      if (getMetaMask()?.selectedAddress && connectMetaMask && !disconnectedMetamask) {
        connectMetaMask()
      } else {
        const walletConnect = _createWalletConnectProvider()
        if (walletConnect.wc.accounts.length) {
          connectWalletConnect()
        }
      }
    }

    // it takes some time for metamask to populate "selectedAddress", so wait a little bit
    setTimeout(cb, 250)
  }, [])

  if(!provider || !account) {
    return (
      <WalletContext.Provider
        value={["disconnected", {
          connectMetaMask,
          connectWalletConnect,
        }]} 
      >{children}</WalletContext.Provider>
    )
  }

  async function disconnect() {
    if (!provider) {
      return
    }

    if (provider.provider instanceof WalletConnectProvider) {
      await provider.provider.disconnect()
    } else {
      setDisconnectedMetamask(true)
      provider.emit("disconnect")
    }
  }

  function onDisconnect() {
    ReactDOM.unstable_batchedUpdates(() => {
      setAccount(undefined)
      setBalance(BigNumber.from(0))
      setCurrentchainId(undefined)
      setProvider(undefined)
    })
  }

  const requestAddChain = provider?.provider.isMetaMask ? async () => {
    if(!provider || !provider.provider.request) {
      return
    }
    if(!chainInfo) {
      console.error("chainInfo not set in WalletContextProvider")
      return
    }
    try {
      await provider.provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: utils.hexlify(chainId),
            chainName: chainInfo.name,
            nativeCurrency: {
              name: chainInfo.name,
              symbol: chainInfo.symbol,
              decimals: chainInfo.decimals
            },
            rpcUrls: [rpcAddress],
          },
        ],
      })
    } catch (e) {
      console.error(e)
    }
  } : undefined

  function isOnTargetChain() {
    return currentChainId === chainId
  }

  const requestSwitchToCorrectChain = provider?.provider.isMetaMask ? async () => {
    if(!provider || !provider.provider.request) {
      return
    }
    if(!isOnTargetChain()) {
      try {
        await provider.provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${(chainId).toString(16)}` }],
        })
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask.
  
        if (switchError.code === 4902 && requestAddChain) {
          await requestAddChain()
        }
      }
    }
  } : undefined

  return (
    <WalletContext.Provider
      value={["connected", {
        account: account!,
        provider,
        disconnect,
        targetChainBalance: { value: balance, refresh: refreshBalance },
        walletInfo,
        currentChainId,
        requestSwitchToCorrectChain
      }]}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useBlockchain() {
  return useContext(WalletContext);
}