/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file Config page for a park.
 */

import {useEffect, useRef, useState} from "react"
import {useLocation, useParams} from "react-router"
import {toast} from "react-toastify"
import {AlertConfig, alertOption} from "../api/alertConfig"
import {rideTime} from "../api/queueAlertAccess"
import ConfigSaveButton from "./ConfigSaveButton"
import {useConfig} from "./ConfigStore"
import ConfigTable from "./configTable"
import {useQaClient} from "./qaUrlStore"
import RideConfig from "./RideConfig"
import _ from "lodash"
import {useMediaQuery} from "react-responsive"
import ServerError from "./Error"
import QASpinner from "./QASpinner"

/**
 * Config page for a park.
 */
function Park() {
    let {park} = useParams<{ park: string }>()
    park = park!.split('?')[0].replaceAll('-', ' ') //Remove query string and hyphens
    const parkUrl = useQuery().get('url')

    const isMobile = useMediaQuery({query: "(max-width: 1200px)"})

    const {client} = useQaClient()
    const [error, setError] = useState(false)
    const [loaded, setLoaded] = useState(false)

    //Get all rides for park
    const [rides, setRides] = useState<rideTime[]>([])
    useEffect(() => {
        client.getParkRideTimes(new URL(parkUrl ?? "Fails"))
            .then(res => {
                if (res.ok) {
                    setRides(res.val)
                    setLoaded(true)
                } else {
                    console.error(res.val)
                    setError(true)
                }
            })
    }, [client, parkUrl])

    //Handling config state
    const [config, dispatch] = useConfig()
    const oldConfig = useRef(_.cloneDeep(config)) //Clone old config for diffing

    //Manage toast state each update
    useEffect(() => {
        console.debug(`config is ${JSON.stringify(config[1])} oldconfig is ${JSON.stringify(oldConfig.current[1])}`)

        //Display save warning if not already visible and changes have been made.
        if (!_.isEqual(config[1], oldConfig.current[1]) && !toast.isActive(1234)) {
            toast.warn(
                <div>
                    <span className="toast-text">
                        You have unsaved changes!
                    </span>
                    <ConfigSaveButton onSave={onSave} visable={true}/>
                </div>
                , {
                    closeButton: false,
                    autoClose: false,
                    toastId: 1234,
                    draggable: false,
                    closeOnClick: false,
                    position: (isMobile ? 'bottom-right' : 'top-right')
                })
        }
        //Remove toast if changes are reverted.
        else if (_.isEqual(config[1], oldConfig.current[1]) && toast.isActive(1234)) {
            toast.dismiss(1234)
        }
    }, [config, isMobile, oldConfig])

    //Remove the above set 'not saved' toast if user navigates back, and reset config to last saved.
    useEffect(() => {
        return () => {
            console.debug(`in the unmount, oldConfig is:` + JSON.stringify(oldConfig.current))
            dispatch({
                type: 'loadConfig',
                oldConfig: oldConfig.current
            })
            toast.dismiss(1234)
        }
    }, [dispatch, oldConfig])

    //Callback to add ride
    const onRideEnable = (userSelection: alertOption, rideName: string) => {
        console.debug('on onEnable')
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
        console.debug(`after save setting oldConf to ${JSON.stringify(conf[1])}`)
        oldConfig.current = _.cloneDeep(conf)
    }

    if (error) {
        return (
            <ServerError/>
        )
    }

    function getRides() {
        if (rides.length === 0 && loaded) {
            return (<p className="park-norides">No rides to show :(</p>)
        } else if (!loaded) {
            return (<QASpinner/>)
        } else {
            // Remove duplicated rides that sometimes pop up from the API
            let uniqueRides = [...new Set(rides)]
            return uniqueRides.map(r => {
                return (
                    <RideConfig rideInfo={r} onEnable={onRideEnable} onDisable={onRideDisable} key={r.name}/>
                )
            });
        }
    }

    return (
        <div>
            <h1 id="parkprompt">Please configure your alerts for {park}:</h1>
            <ConfigTable onSave={onSave}/>

            <div className="rides-container">
                {
                    getRides()
                }
            </div>
        </div>
    )
}

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

export default Park