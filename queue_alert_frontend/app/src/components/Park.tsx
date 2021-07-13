/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { useEffect, useState } from "react"
import { useLocation, useParams } from "react-router"
import { toast } from "react-toastify"
import { AlertConfig } from "../api/alertConfig"
import { rideTime } from "../api/queueAlertAccess"
import ConfigSaveButton from "./ConfigSaveButton"
import { useConfig } from "./ConfigStore"
import ConfigTable from "./configTable"
import { useQaClient } from "./qaUrlStore"
import RideConfig from "./RideConfig"

function Park() {
    let { park } = useParams<{ park: string }>()
    park = park.split('?')[0].replaceAll('-', ' ') //Remove query string and hyphens
    const parkUrl = useQuery().get('url')

    const { client } = useQaClient()
    const [error, setError] = useState(false)

    //Get all rides for park
    const [rides, setRides] = useState<rideTime[]>([])
    useEffect(() => {
        client.getParkRideTimes(new URL(parkUrl ?? "Fails"))
            .then(res => {
                if (res.ok) {
                    setRides(res.val)
                }
                else {
                    console.error(res.val)
                    setError(true)
                }
            })
    }, [client, parkUrl])

    //Handling config state
    const [config, dispatch] = useConfig()
    const [oldConfig, setOldConfig] = useState(JSON.parse(JSON.stringify(config)) as AlertConfig) //Clone old config for diffing

    useEffect(() => {
        //Reset the config to null if nothing is selected. This prevents the empty table glitch.
        if (config[1].length === 0 && config[0] !== 'none') {
            console.debug('reseting config ')
            dispatch({
                type: "reset"
            })
        }
    })

    //Manage toast state each update
    useEffect(() => {
        console.debug(`config is ${JSON.stringify(config[1])} oldconfig is ${JSON.stringify(oldConfig[1])}`)

        //Display save warning if not already visible and changes have been made.
        if (!arrayEqualNoOrder(config[1], oldConfig[1]) && !toast.isActive(1234)) {
            toast.warn('You have unsaved changes!', { closeButton: false, autoClose: false, toastId: 1234, draggable: false, closeOnClick: false })
        }
        else if (arrayEqualNoOrder(config[1], oldConfig[1]) && toast.isActive(1234)) { //Remove if oldConfig is config ie no changes
            toast.dismiss(1234)
        }
    }, [config, oldConfig])

    //Remove the above set 'not saved' toast if user navigates back, and reset config to last saved.
    useEffect(() => {
        return () => {
            console.error('In the unmount early!')//TODO this is firing too early and causing weirdness.
            toast.dismiss(1234)
            dispatch({
                type: 'loadConfig',
                oldConfig: oldConfig
            })
        }
    }, [])//Ignore this lint, this must only run on umount

    //Callback to add ride
    const onRideEnable = (userSelection: "Open" | "Closed" | number, rideName: string) => {
        //If this is the first ride selected in a new park, then change to this park.
        if (config[0] !== park) {
            dispatch({
                type: "changePark",
                park: park, /*must remove '-' else this will silently stop pushes*/
                ride: {
                    rideName: rideName,
                    alertOn: userSelection
                }
            })
        }

        dispatch({
            type: "addRide",
            ride: {
                rideName: rideName,
                alertOn: userSelection
            }
        })
    }

    //Callback to remove ride
    const onRideDisable = (rideName: string) => {
        dispatch({
            type: "removeRide",
            ride: {
                rideName: rideName,
                alertOn: 'Closed'
            }
        })
    }

    const onSave = (conf: AlertConfig) => {
        toast.dismiss(1234)
        setOldConfig(conf)
    }

    if (error) {
        return (
            <p>Could not hit backend!</p>
        )
    }

    return (
        <div>
            <h1>Ride times for {park}!</h1>
            <ConfigTable />

            {rides.map(r => {
                //Attempt to load already set config if it exists.
                const oldRideConfig = config[1].find(r2 => r2.rideName === r.name)

                return (
                    <RideConfig rideInfo={r} onEnable={onRideEnable} onDisable={onRideDisable} currentAlert={oldRideConfig == null ? undefined : oldRideConfig.alertOn} key={r.name}></RideConfig>
                )
            })}

            <ConfigSaveButton onSave={onSave} />
        </div>
    )
}

/** Checks if arrays contain the same elements, out of order. */
function arrayEqualNoOrder<T>(arr1: Array<T>, arr2: Array<T>): boolean {
    //if (arr1.length !== arr2.length) { return false }

    for (const elm of arr1) {
        const res = arr2.includes(elm)

        if (!res) { return false }
    }

    return true
}

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

export default Park