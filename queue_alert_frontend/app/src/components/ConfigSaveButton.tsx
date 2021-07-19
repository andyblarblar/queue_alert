/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { AlertConfig, sendConfigToSW } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"
import { useQaClient } from "./qaUrlStore"
import { toast } from 'react-toastify';


type props = { onSave?: (conf: AlertConfig) => void }

/**
 * A button that actually saves the config on the SW when clicked.
 * onSave prop is called when a config is successfully saved to the SW.
 */
const ConfigSaveButton: React.FC<props> = ({ onSave }) => {//TODO style
    const [config, _] = useConfig()
    const { client } = useQaClient()

    const handleClick = async () => {
        //Unsub user from services if config is empty.
        if (config[1].length === 0) {
            await client.unregisterWithBackend()//Ignore failures
            await client.unsubscribeUserFromPush()
        }
        //Sub if config is anything else
        else {
            let res1 = await client.subscribeUserToPush()
            let res2 = await client.registerWithBackend(config[0])

            if (res1.err || res2.err) {
                toast.error('Failed to save! Could not contact server.')
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

    return (
        <div className="save-btn">
            <button onClick={handleClick}>Save config</button>
        </div>
    )
}

export default ConfigSaveButton
