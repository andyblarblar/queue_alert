/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { useEffect, useRef } from "react"
import { useLocation, Navigate } from "react-router-dom"
import { toast } from "react-toastify"
import { sendConfigToSW } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"
import { useQaClient } from "./qaUrlStore"

/**Component that loads a shared config from the query params, and then redirects to the main page.*/
function SharedHome() {
    const redirect = useRef(false)
    const { client } = useQaClient()

    //Load config from shared link, then redirect.
    const [_, dispatch] = useConfig()
    const params = useQuery()
    const sharedConfig = params.get('config')

    useEffect(() => {
        if (sharedConfig) {
            console.debug('reading shared config.')
            console.debug(decodeURI(sharedConfig))
            const realSharedConfig = JSON.parse(decodeURI(sharedConfig))
            redirect.current = true

            //Sub user right away
            client.subscribeUserToPush().then(res1 => {
                client.registerWithBackend(realSharedConfig[0]).then(res2 => {
                    if (res1.err) {
                        toast.error('Failed to save! Please enable notifications for this site.')
                    }
                    else if (res2.err) {
                        toast.error('Failed to save! Could not contact server. It may be down, or an internal error occurred.')
                    }
                    else {
                        sendConfigToSW(realSharedConfig).then(saveResult => {
                            if (saveResult.ok) {
                                toast.success('Saved config from shared link!')

                                //Load config in memory here so it actually gets saved
                                dispatch({ type: 'loadConfig', oldConfig: realSharedConfig })
                            }
                            else {
                                toast.error('Failed to save! ' + saveResult.val.message)
                            }
                        })
                    }
                })
            })
        }
        else {
            console.error('failed to read shared config')
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sharedConfig])

    return redirectOrNot(redirect.current)
}

function redirectOrNot(shouldRedirect: boolean) {
    return shouldRedirect ? <Navigate to="/" /> : <div>Loading shared config...</div>
}

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

export default SharedHome
