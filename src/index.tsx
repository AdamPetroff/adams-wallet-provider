import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

import AdamsWalletProvider from './AdamsWalletProvider';

ReactDOM.render(
  <React.StrictMode>
    <AdamsWalletProvider chainId={56} rpcAddress='https://bsc-dataseed.binance.org/'>
      <App />
    </AdamsWalletProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

