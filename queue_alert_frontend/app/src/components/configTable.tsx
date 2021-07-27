/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { FaShareAlt } from "react-icons/fa"
import { toast } from "react-toastify"
import { AlertConfig, rideConfig } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"

/**
 * Table filled with readonly contents of the current config.
 */
function ConfigTable() {
    const [config, _] = useConfig()

    //Clicking this config share btn will make a link that contains all of this configs info.
    const shareSiteIfPossible = () => {
        //Most browsers don't have the share api yet.
        if ("share" in navigator) {
            navigator.share({ text: "Check out Queue Alert!", url: `https://qalert.ealovega.dev/share?config=${JSON.stringify(config)}` }).then()
        }
        //Fallback to clipboard and prompt toast announcing such.
        else if ("clipboard" in navigator) {
            navigator.clipboard.writeText(`https://qalert.ealovega.dev/share?config=${JSON.stringify(config)}`).then()
            toast.success('Copied config link to clipboard!')
        }
    }

    if (config[0] === 'none') {
        return <div></div>
    }
    else {
        return (
            <div className="config-table">
                <table>
                    <caption>Current Config
                        
                        <div className="config-share-btn" style={{ display: "inline", marginLeft: "7px" }} onClick={shareSiteIfPossible} title="share this config">
                            <FaShareAlt size='29' opacity='0.9' />
                        </div>
                    </caption>

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
