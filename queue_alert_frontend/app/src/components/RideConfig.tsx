/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file Component that contains the controls for configuring a ride.
 */

import React, { useState } from "react"
import { rideTime } from "../api/queueAlertAccess"
import Switch from "react-switch"

type currentAlertOn = "Open" | "Closed" | number

type props = {
    /**Current ride status*/
    rideInfo: rideTime,
    /**Current config if already set before*/
    currentAlert?: currentAlertOn,
    /**Called when config is enabled*/
    onEnable: (userSelection: "Open" | "Closed" | number, rideName: string) => void
    /**Called when config is disabled*/
    onDisable: (rideName: string) => void
}

const RideConfig: React.FC<props> = ({ rideInfo, currentAlert, onEnable, onDisable }) => {
    const [config, setConfig] = useState<currentAlertOn | undefined>(currentAlert)
    const [switchChecked, setSwitchChecked] = useState(config != null)

    /**Creates the select component that handles the user facing alert configs*/
    const getSelect = () => {
        const opt = Array(80).fill(0).map((_, i) => (i + 1) * 5);

        const selectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
            //If switching from one config to another while already enabled, do that on select change.
            if (switchChecked) {
                switch (event.target.value) {
                    case "none":
                        break;

                    case "Open":
                        onEnable("Open", rideInfo.name)
                        setConfig("Open")
                        break;

                    case "Closed":
                        onEnable("Closed", rideInfo.name)
                        setConfig("Closed")
                        break;

                    default:
                        onEnable(parseInt(event.target.value), rideInfo.name)
                        setConfig(parseInt(event.target.value))
                        break;
                }
            }

            //This will enable the switch, clicking it will set the config.
            switch (event.target.value) {
                case "none":
                    break;

                case "Open":
                    setConfig("Open")
                    break;

                case "Closed":
                    setConfig("Closed")
                    break;

                default:
                    setConfig(parseInt(event.target.value))
                    break;
            }
        }

        return (
            <select onChange={selectChange} value={config ?? 'none'}>
                <option value="none">Select a time to alert on</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                {
                    opt.map(min => {
                        return <option value={min}>{`${min}< min`}</option>
                    })
                }
            </select>
        )
    }

    /**Call the respective prop when switch is activated.*/
    const onSwitchEnable = (checked: boolean, event: MouseEvent | React.SyntheticEvent<MouseEvent | KeyboardEvent, Event>, id: string) => {
        if (checked) {
            onEnable(config!, rideInfo.name)
            setSwitchChecked(true)
        }
        else {
            onDisable(rideInfo.name)
            setConfig(undefined)
            setSwitchChecked(false)
        }
    }

    return (
        <div className="rideconfig">
            <span>{rideInfo.name}</span>
            <Switch checked={switchChecked} disabled={config == null} onChange={onSwitchEnable}></Switch> {/**Enable Switch when something is selected. Switch on actually sets the config.*/}

            <br />

            <span>Current wait: {typeof rideInfo.status === 'string' ? rideInfo.status : rideInfo.status.Wait} </span>
            <span>Alert on: </span>
            {getSelect()}

            <br />
        </div>
    )
}

export default RideConfig