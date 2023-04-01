/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route
}
  from "react-router-dom";
import Home from './components/Home';
import Park from './components/Park';
import { QaClientProvider } from './components/qaUrlStore';
import { ConfigProvider } from './components/ConfigStore';
import { AlertConfig, getConfigFromSW } from './api/alertConfig';
import { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css'
import 'react-pro-sidebar/dist/css/styles.css';
import { useMediaQuery } from 'react-responsive'
import Hamburger from './components/hamburger';
import SideBar from './components/SideBar';
import Headroom from 'react-headroom'
import About from './components/About';
import SharedHome from './components/SharedHome';

export default function App() {

  //Update SW on app load if possible.
  useEffect(() => {
    navigator.serviceWorker.getRegistration('/').then(sw => {
      if (sw) {
        //First check if new SW
        sw.update().then()

        //Then enable it
        if (sw.waiting) {
          sw.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      }
    })
  })

  //Load persisted config on app load
  const initalConfig = useSWConfig()

  //Media query to enable disable hamburger to un-collapse the sidebar
  const isLargeScreen = useMediaQuery({ query: "(min-width: 1200px)" })

  const [sideBarOpen, setSideBarOpen] = useState(isLargeScreen)

  //Enables the hamburger header on mobile.
  const hamburgerOrNot = () => {
    return !isLargeScreen ? <Headroom
      style={{
        background: '#96491af8',
        boxShadow: '1px 1px 1px rgba(0,0,0,0.55)',
        width: '100%'
      }}>
      <Hamburger onClick={() => { setSideBarOpen(true) }} />
    </Headroom>
      : <> </>
  }

  //Get the right URL for the server
  let qaUrl: string
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
    qaUrl = "http://localhost:8080"
  } else {
    qaUrl = "https://qalert.ealovega.dev"
  }

  return (
    <QaClientProvider url={qaUrl}>
      <ConfigProvider oldConfig={initalConfig ?? undefined}>

        <div className="app-container">
          <Router>

            <div className="bar-container">
              <SideBar toggled={sideBarOpen} onToggle={(val) => { setSideBarOpen(!sideBarOpen) }} onItemClick={() => { setSideBarOpen(!sideBarOpen) }} />
            </div>

            <div className="content-container">
              {hamburgerOrNot()}

              <Routes>

                <Route path="/">
                  <Home />
                </Route>

                <Route path="/about">
                  <About />
                </Route>

                <Route path="/park/:park">
                  <Park />
                </Route>

                <Route path="/share">
                  <SharedHome />
                </Route>

              </Routes>
            </div>

          </Router>
        </div>

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
