/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { AlertConfig, sendConfigToSW } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"
import { useQaClient } from "./qaUrlStore"
import { toast } from 'react-toastify';


type props = { onSave? : (conf: AlertConfig) => void}

/**
 * A button that actually saves the config on the SW when clicked.
 * onSave prop is called when a config is successfully saved to the SW.
 */
 const ConfigSaveButton: React.FC<props> = ({ onSave }) => {
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
            await client.subscribeUserToPush()
            await client.registerWithBackend(config[0])
        }

        //Persist on SW
        await sendConfigToSW(config)
        toast.success('Config saved!')

        if (onSave) {onSave(config)}
    }

    return (
        <div className="save-btn">
            <button onClick={handleClick}>Save config</button>
        </div>
    )
}

export default ConfigSaveButton
