/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { sendConfigToSW } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"

/**
 * A button that actually saves the config on the SW when clicked.
 */
function ConfigSaveButton() {
    const [config, _] = useConfig()

    const handleClick = async () => {
        await sendConfigToSW(config)
    }

    return (
        <div className="save-btn">
            <button onClick={handleClick}>Save config</button>
        </div>
    )
}

export default ConfigSaveButton
