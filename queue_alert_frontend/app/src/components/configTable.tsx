/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { AlertConfig, rideConfig } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"

/**
 * Table filled with readonly contents of the current config.
 */
function ConfigTable() {
    const [config, _] = useConfig()

    if (config[0] === 'none') {
        return <div></div>
    }
    else {
        return (
            <div className="config-table">
                <table>
                    <caption>Current Config</caption>
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 'bold' }}>Ride</td>
                            <td style={{ fontWeight: 'bold' }}>Alert when ride is</td>
                        </tr>
                        {
                            getRows(config)
                        }
                    </tbody>
                </table>
            </div>
        )
    }
}

function getRows(config: AlertConfig) {
    return config[1].map(r => {
        return (
            <tr key={r.rideName}>
                <td>{r.rideName}</td>
                <td>{getProperAlertOnString(r)}</td>
            </tr>
        )
    })
}

function getProperAlertOnString(rideConfig: rideConfig) {
    if (typeof rideConfig.alertOn === 'string') {
        return rideConfig.alertOn
    }
    else {
        return `wait under ${rideConfig.alertOn} minutes`
    }
}

export default ConfigTable
