/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @files Exposes a context to access a global and persistent alert config. 
 */

import { AlertConfig } from "../api/alertConfig"
import { action, useConfigReducer } from "./ConfigReducer"
import React, { useContext, useRef } from "react"

const configContext = React.createContext<[AlertConfig, React.Dispatch<action>]>([["none", []], () => { }])

type props = { oldConfig?: AlertConfig }

/**
 * Provides access to an alert config. oldConfig can optionally be passed to load a previous Config on mount.
 */
export const ConfigProvider: React.FC<props> = ({ children, oldConfig }) => {
    const [state, dispatch] = useConfigReducer()
    const appliedOldConfig = useRef(false) //Prevents the oldConfig from being applied on every re-render

    if (oldConfig != null && !appliedOldConfig.current) {//This condition is very important, as it causes infinite recursion without a base case 
        console.debug(`applying oldconfig in provider. This should not repeat`)
        appliedOldConfig.current = true
        dispatch({ type: 'loadConfig', oldConfig: oldConfig })
    }

    return (
        <configContext.Provider value={[state, dispatch]}>
            {children}
        </configContext.Provider>
    )
}

/**
 * Provides access to the alert config and the reducer to modify it.
 */
export const useConfig = () => useContext(configContext)