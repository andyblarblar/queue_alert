/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { useEffect, useRef } from "react"
import { FaShareAlt, FaTrash } from "react-icons/fa"
import { toast } from "react-toastify"
import { AlertConfig, rideConfig } from "../api/alertConfig"
import { useConfig } from "./ConfigStore"
import UseConfigSave from "./UseConfigSave"


type props = { /**Called when a config is successfully saved.*/ onSave?: (conf: AlertConfig) => void }

/**
 * Table filled with readonly contents of the current config.
 */
const ConfigTable: React.FC<props> = ({ onSave }) => {
    const [config, dispatch] = useConfig()

    const saveConfig = UseConfigSave(onSave)
    const saveNextRefresh = useRef(false)

    useEffect(() => {
        //Reset the config to null if nothing is selected. This prevents the empty table glitch.
        if (config[1].length === 0 && config[0] !== 'none') {
            console.debug('reseting config ')
            dispatch({
                type: "reset"
            })
        }
    })

    //Save config when delete button pressed.
    useEffect(() => {
        if (saveNextRefresh.current) {
            saveNextRefresh.current = false
            saveConfig().then()
        }
    })

    //Clicking this config share btn will make a link that contains all of this configs info.
    const shareSiteIfPossible = () => {
        //Most browsers don't have the share api yet.
        if ("share" in navigator) {
            navigator.share({ text: "Check out Queue Alert!", url: `https://qalert.ealovega.dev/share?config=${JSON.stringify(config)}` }).then()
        }
        //Fallback to clipboard and prompt toast announcing such.
        else if ("clipboard" in navigator) {
            (navigator as Navigator).clipboard.writeText(`https://qalert.ealovega.dev/share?config=${JSON.stringify(config)}`).then()
            toast.success('Copied config link to clipboard!')
        }
    }

    function getRows() {
        return config[1].map(r => {

            const onDeleteClick = () => {
                saveNextRefresh.current = true
                dispatch({
                    type: "removeRide",
                    ride: { rideName: r.rideName, alertOn: { wait: 0 } }
                })
            }

            return (
                <tr key={r.rideName}>
                    <td>{r.rideName}</td>
                    <td>{getProperAlertOnString(r)}</td>
                    <td>
                        <FaTrash onClick={onDeleteClick} className="table-delete-icon" size='20'></FaTrash>
                    </td>
                </tr>
            )
        })
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
                            <td style={{ fontWeight: 'bold' }}>Delete</td>
                        </tr>
                        {
                            getRows()
                        }
                    </tbody>
                </table>
            </div>
        )
    }
}



function getProperAlertOnString(rideConfig: rideConfig) {
    if (typeof rideConfig.alertOn === 'string') {
        return rideConfig.alertOn
    }
    else {
        return `wait under ${rideConfig.alertOn.wait} minutes`
    }
}



export default ConfigTable
