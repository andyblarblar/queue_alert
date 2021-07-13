/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { parkMap } from "../api/queueAlertAccess"
import { useConfig } from "./ConfigStore"
import ConfigTable from "./configTable"
import { useQaClient } from "./qaUrlStore"

function Home() {
    const [parkmap, setparkmap] = useState(new Map<string, string>())
    const [error, seterror] = useState(false)
    const { client } = useQaClient()
    const [config, _] = useConfig()//TODO remove

    useEffect(() => {
        //Hit backend
        client.getAllParks()
            .then(res => {
                if (res.ok) {
                    setparkmap(res.val)
                } else {
                    seterror(true)
                }
            })
            .catch(err => {
                console.debug(err)
                seterror(true)
            })
    }, [client])


    if (!error && parkmap.size === 0) {
        return (
            <div>
                <p>Loading...</p>
            </div>
        )
    }
    else if (error) {
        return (
            <div>
                <p style={{ color: 'red' }}>Could not hit backend!</p>
            </div>
        )
    }
    else {
        return (
            <div>
                <ConfigTable />
                <p id="parkprompt">Please select a park:</p>
                <div className="parks-container">
                    {
                        createParkList(parkmap)
                    }
                </div>
            </div>
        )
    }
}

function createParkList(parkmap: parkMap): JSX.Element[] {
    let htmlList = []

    for (const [park, url] of Object.entries(parkmap)) {
        let safeUrl = park.replaceAll(' ', '-')
        let safeQuery = new URLSearchParams({ "url": url.toString() }).toString()

        let tsx = (
            <div className="park-link" key={park}>
                <Link to={'/park/' + safeUrl + '?' + safeQuery}>{park}</Link>
            </div>
        )

        htmlList.push(tsx)
    }
    return htmlList
}

export default Home
