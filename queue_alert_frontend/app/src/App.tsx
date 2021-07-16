/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import './App.css';
import {
  BrowserRouter as Router,
  Switch,
  Route
}
  from "react-router-dom";
import Home from './components/Home';
import Park from './components/Park';
import { QaClientProvider } from './components/qaUrlStore';
import { ConfigProvider } from './components/ConfigStore';
import { AlertConfig, getConfigFromSW } from './api/alertConfig';
import { useEffect, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css'

//TODO style the app and add to SW manifest
//TODO add a side menu that has an about/FAQ page, as well as return to home.
export default function App() {

  //Load persisted config on app load
  const initalConfig = useSWConfig()

  return (
    <QaClientProvider url="http://localhost:8080">
      <ConfigProvider oldConfig={initalConfig ?? undefined}>

        <Router>
          <Switch>

            <Route exact path="/">
              <Home />
            </Route>
            {/** Put other set paths eg. about here*/}

            <Route path="/park/:park">
              <Park />
            </Route>

          </Switch>
        </Router>
        <ToastContainer />
      </ConfigProvider>
    </QaClientProvider>
  );
}

/**
 * Attempts to load the previously set config from the SW. null if never set.
 * @returns The last stored config in the SW, if set.
 */
function useSWConfig() {
  //Attempt to load from SW
  let [initalConfig, setInitalConfig] = useState<AlertConfig | null>(null)
  useEffect(() => {
    getConfigFromSW().then((config) => {
      setInitalConfig(config)
    })
  }, [])

  return initalConfig
}
