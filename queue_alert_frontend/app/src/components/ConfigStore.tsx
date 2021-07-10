/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @files Exposes a context to access a global and persistent alert config. 
 */

import { AlertConfig } from "../api/alertConfig"
import { action, useConfigReducer } from "./ConfigReducer"
import React, { useContext } from "react"

const configContext = React.createContext<[AlertConfig, React.Dispatch<action>]>([["none",[]],() => {}])

type props = {oldConfig?: AlertConfig}

/**
 * Provides access to an alert config. oldConfig can optionally be passed to load a previous Config on mount.
 */
export const ConfigProvider: React.FC<props> = ({children, oldConfig}) => {
    const [state, dispatch] = useConfigReducer()

    if (oldConfig != null) {
    dispatch({type: 'loadConfig', oldConfig: oldConfig })
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