/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file Component that contains the controls for configuring a ride.
 */

import React from "react"
import { rideTime } from "../api/queueAlertAccess"
import Switch from "react-switch"
import useStateCallback from "../api/useEffectCallback"
import { useConfig } from "./ConfigStore"

type currentAlertOn = "Open" | "Closed" | { wait: number} //TODO refactor all instances of this structure into one type

type props = {
    /**The name of this ride*/
    rideInfo: rideTime,
    /**Called when config is enabled*/
    onEnable: (userSelection: currentAlertOn, rideName: string) => void,
    /**Called when config is disabled*/
    onDisable: (rideName: string) => void,
}

/**
 * Component that contains the controls for configuring a ride.
 */
const RideConfig: React.FC<props> = ({ rideInfo, onEnable, onDisable }) => {
    const [globalConfig, ] = useConfig()

    //Attempt to load already set config if it exists.
    const oldRideConfig = globalConfig[1].find(r2 => r2.rideName === rideInfo.name)
    //Check the switch if already in use. This ties this switches state to the global config.
    const switchChecked = oldRideConfig != null

    //Local config used for saving select box state. This is independent of the global config.
    const [switchSelectedConfig, setConfig] = useStateCallback<currentAlertOn | undefined>(oldRideConfig?.alertOn)

    /**Creates the select component that handles the user facing alert configs*/
    const getSelect = () => {
        const opt = Array(80).fill(0).map((_, i) => (i + 1) * 5);

        const selectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
            //If switching from one config to another while already enabled, swap configs immediately.
            if (switchChecked) {
                switch (event.target.value) {
                    case "none":
                        break;

                    case "Open":
                        onEnable('Open', rideInfo.name)
                        setConfig("Open")
                        break;

                    case "Closed":
                        onEnable("Closed", rideInfo.name)
                        setConfig("Closed")
                        break;

                    default:
                        onEnable({ wait: parseInt(event.target.value) }, rideInfo.name)
                        setConfig({ wait: parseInt(event.target.value) })
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
                    setConfig({ wait: parseInt(event.target.value) })
                    break;
            }
        }

        // Need to flatten away wait to match select value type
        let flattenedSelectedConfig
        if (typeof switchSelectedConfig === "string") {
            flattenedSelectedConfig = switchSelectedConfig
        } else {
            flattenedSelectedConfig = switchSelectedConfig?.wait
        }

        return (
            <select onChange={selectChange} value={flattenedSelectedConfig ?? 'none'}>
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
            onEnable(switchSelectedConfig!, rideInfo.name)
        }
        else {
            onDisable(rideInfo.name)
        }
    }

    return (
        <div className="rideconfig">
            <span className="rideconfig-ridename">{rideInfo.name}</span>

            <Switch className="rideconfig-switch" offColor="#855846" uncheckedIcon={false} checkedIcon={<span style={{ marginLeft: "5px", opacity: "0.9" }}>🎢</span>} checked={switchChecked} disabled={switchSelectedConfig == null} onChange={onSwitchEnable}>
            </Switch>

            <br />

            <div className="rideconfig-current-wait">
                <span>Current wait: {typeof rideInfo.status === 'string' ? rideInfo.status : rideInfo.status.Wait} </span>
            </div>

            <span className="rideconfig-alert">Alert on: </span>
            {getSelect()}

            <br />
        </div>
    )
}

export default RideConfig
