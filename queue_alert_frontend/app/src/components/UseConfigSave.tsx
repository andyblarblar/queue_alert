/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { toast } from "react-toastify"
import { AlertConfig, sendConfigToSW } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"
import { useQaClient } from "./qaUrlStore"

/**
 * Hook that returns a function that will persist the current config on the SW when called. 
 * This function may or may not succeed, but will not throw. It instead prompts a correct failure toast.
 * @param onSave Function to be called with the new config if config is saved successfully.
 * @returns Closure that saves current config on call.
 */
function UseConfigSave(onSave: ((config: AlertConfig) => void) | undefined) {
    const [config,] = useConfig()
    const { client } = useQaClient()

    return async () => {
        //Unsub user from services if config is empty.
        if (config[1].length === 0) {
            await client.unregisterWithBackend()//Ignore failures
            await client.unsubscribeUserFromPush()
        }
        //Sub if config is anything else
        else {
            let res1 = await client.subscribeUserToPush()
            let res2 = await client.registerWithBackend(config[0])

            if (res1.err) {
                toast.error('Failed to save! Please enable notifications for this site.')
                return
            }
            if (res2.err) {
                toast.error('Failed to save! Could not contact server. It may be down, or an internal error occurred.')
                return
            }
        }

        //Persist on SW
        const saveResult = await sendConfigToSW(config)

        if (saveResult.ok) {
            toast.success('Config saved!')
        }
        else {
            toast.error('Failed to save! ' + saveResult.val.message)
        }

        if (onSave && saveResult.ok) {
            onSave(config)
        }
    }
}

export default UseConfigSave
