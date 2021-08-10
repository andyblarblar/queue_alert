/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { AlertConfig, sendConfigToSW } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"
import { useQaClient } from "./qaUrlStore"
import { toast } from 'react-toastify';
import UseConfigSave from "./UseConfigSave";


type props = { onSave?: (conf: AlertConfig) => void, visable: boolean }

/**
 * A button that actually saves the config on the SW when clicked.
 * onSave prop is called when a config is successfully saved to the SW.
 */
const ConfigSaveButton: React.FC<props> = ({ onSave, visable }) => {
    const save = UseConfigSave(onSave)

    return (
        <div className="save-btn" style={{visibility: (visable ? 'visible' : 'hidden')}}>
            <button onClick={save}>Save config</button>
        </div>
    )
}

export default ConfigSaveButton
