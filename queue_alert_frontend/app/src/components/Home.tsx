/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file Home page of the app. Will cache parks on first ever render.
 */

import {useEffect, useState} from "react"
import {Link} from "react-router-dom"
import {toast} from "react-toastify"
import {parkMap} from "../api/queueAlertAccess"
import ConfigTable from "./configTable"
import ServerError from "./Error"
import {useQaClient} from "./qaUrlStore"
import {SearchBar} from "./Search";

function Home() {
    const [parkmap, setparkmap] = useState(new Map<string, string>())
    const [error, seterror] = useState(false)
    const [filter, setfilter] = useState<string | null>(null)
    const {client} = useQaClient()

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
            <ServerError/>
        )
    } else {
        return (
            <div>
                <ConfigTable onSave={() => {
                    toast.dismiss(1234)
                }}/>

                <p id="parkprompt">Please select a park:</p>

                <div className="search-container-container">
                    <SearchBar onChange={(s) => {
                        setfilter(s.trim())
                    }} placeholderText={"Search parks"}/>
                </div>

                <div className="parks-container">
                    {
                        createParkList(parkmap, filter)
                    }
                </div>
            </div>
        )
    }
}

function createParkList(parkmap: parkMap, filter: string | null): JSX.Element[] {
    let htmlList = []

    // Show all parks filtered by search
    for (const [park, url] of Object.entries(parkmap).filter(([park, url]) => filter == null || park.search(RegExp(`.*${filter!}.*`, "i")) !== -1)) {
        let safeUrl = park.replaceAll(' ', '-')
        let safeQuery = new URLSearchParams({"url": url.toString()}).toString()

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
