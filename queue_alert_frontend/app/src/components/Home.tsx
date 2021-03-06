/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file Home page of the app. Will cache parks on first ever render.
 */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "react-toastify"
import { parkMap } from "../api/queueAlertAccess"
import ConfigTable from "./configTable"
import ServerError from "./Error"
import { useQaClient } from "./qaUrlStore"

function Home() {
    const [parkmap, setparkmap] = useState(new Map<string, string>())
    const [error, seterror] = useState(false)
    const { client } = useQaClient()

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


    if (error) {
        return (
            <ServerError />
        )
    }
    else {
        return (
            <div>
                <ConfigTable onSave={() => { toast.dismiss(1234) }} />

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
