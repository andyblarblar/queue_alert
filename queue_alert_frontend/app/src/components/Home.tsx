/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { parkMap } from "../api/queueAlertAccess"
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
                {
                    createParkList(parkmap)
                }
            </div>
        )
    }
}

function createParkList(parkmap: parkMap): JSX.Element[] {
    let htmlList = []

    let index = 0
    for (const [park, url] of Object.entries(parkmap)) {
        let safeUrl = park.replaceAll(' ', '-')
        let safeQuery = new URLSearchParams({ "url": url.toString() }).toString()

        let tsx = (
            <>
                <Link to={'/park/' + safeUrl + '?' + safeQuery} key={index}>{park}</Link>
                <br />
            </>
        )

        htmlList.push(tsx)
        index += 1
    }
    return htmlList
}

export default Home
