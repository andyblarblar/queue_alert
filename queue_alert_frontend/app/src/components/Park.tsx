/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { useEffect, useState } from "react"
import { useLocation, useParams } from "react-router"
import { rideTime } from "../api/queueAlertAccess"
import ConfigSaveButton from "./ConfigSaveButton"
import { useConfig } from "./ConfigStore"
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
    }, [])

    const [config, dispatch] = useConfig()
    //Callback to add ride
    const onRideEnable = (userSelection: "Open" | "Closed" | number, rideName: string) => {
        //If this is the first ride selected in a new park, then change to this park.
        if (config[0] !== park) {
            dispatch({
                type: "changePark",
                park: park /*must remove '-' else this will silently stop pushes*/
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

    if (error) {
        return (
            <p>Could not hit backend!</p>
        )
    }

    return (
        <div>
            <h1>Ride times for {park}!</h1>
            <p>config: {JSON.stringify(config[1])}</p>
            
            {rides.map(r => {
                //Attempt to load already set config if it exists.
                const oldRideConfig = config[1].find(r2 => r2.rideName === r.name)

                return (
                    <RideConfig rideInfo={r} onEnable={onRideEnable} onDisable={onRideDisable} currentAlert={oldRideConfig == null ? undefined : oldRideConfig.alertOn}></RideConfig>
                )
            })}

            <ConfigSaveButton />
        </div>
    )
}


function useQuery() {
    return new URLSearchParams(useLocation().search);
}

export default Park