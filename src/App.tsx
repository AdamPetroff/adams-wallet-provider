import React from "react"
import { useBlockchain } from './AdamsWalletProvider';
import { ethers } from 'ethers';

function App() {
  const blockchain = useBlockchain()

  return (
    <div className="App">
      {blockchain[0] === "disconnected" ? (
        <>
        <button onClick={() => {
          if(blockchain[1].connectMetaMask) {
            blockchain[1].connectMetaMask()
          }
      }}>Conenct</button>
      <button onClick={() => {
            blockchain[1].connectWalletConnect()
      }}>Conenct2</button></>
      ) : (
        <>
  <button onClick={() => {
    blockchain[1].disconnect()
      }}>connected {blockchain[1].account} {blockchain[1].currentChainId} {ethers.utils.formatEther(blockchain[1].targetChainBalance.value)}</button>
      <img style={{ maxWidth: 200 }} src={blockchain[1].walletInfo.img} alt="" />
      <span>{blockchain[1].walletInfo.name}</span>
      <span>{blockchain[1].walletInfo.web}</span>
        </>
      )}
    </div>
  );
}

export default App;
