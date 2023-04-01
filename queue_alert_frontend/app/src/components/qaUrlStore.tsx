/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import React, { useContext } from "react"
import QueueAlertAccess from "../api/queueAlertAccess"

const qaContext = React.createContext({ client: new QueueAlertAccess("") })

type qaUrlProps = {url: string, children?: React.ReactNode;}
/**
 * Provides access to the QaUrlContext, which gives a client to the queue alert backend.
 */
export const QaClientProvider: React.FC<qaUrlProps> = ({url, children}) => {
    return (
        <qaContext.Provider value={{client: new QueueAlertAccess(url)}}>
            {children}
        </qaContext.Provider>
    )
}

/**
 * Provides a client to the backend API.
 */
export const useQaClient = () => useContext(qaContext)