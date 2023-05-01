/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file Contains a reducer for the ConfigContext.
 */

import { useReducer } from "react"
import {AlertConfig, alertOption} from "../api/alertConfig"

export const useConfigReducer = () => {
    return useReducer(reducer, initConfig(), initConfig)
}

function initConfig(): AlertConfig {
    return ["none", []]
}

function reducer(state: AlertConfig, action: action) {
    switch (action.type) {
        //Add a new ride to the config
        case 'addRide':
            if (action.ride == null) {
                console.error('Submitted a new ride to the config, but the ride was undefined.')
                return state
            }

            //Ignore if already in config
            if (state[1].find(r => r.rideName === action.ride?.rideName && r.alertOn === action.ride?.alertOn) != null) {
                return state
            }

            return [state[0], [...state[1].filter(r => r.rideName !== action.ride?.rideName), action.ride]] as AlertConfig

        //Remove a ride from the config
        case 'removeRide':
            if (action.ride == null) {
                console.error('Submitted a ride to remove from the config, but the ride was undefined.')
                return state
            }
            const removedArr = state[1].filter(r => r.rideName !== action.ride?.rideName)
            return [state[0], removedArr] as AlertConfig

        //Change the selected park and remove all old ride configs
        case 'changePark':
            if (action.park == null) {
                console.error('Submitted a new park to the config, but the park was null.')
                return state
            }
            const resetConfig = initConfig()
            resetConfig[0] = action.park
            if (action.ride) {
                resetConfig[1].push(action.ride)
            }
            return resetConfig

        //Used to load an old config from the SW 
        case 'loadConfig':
            console.debug('loading old config')
            if (action.oldConfig == null) {
                console.error('Submitted a new park to the config, but the park was null.')
                return state
            }
            return action.oldConfig

        case 'reset':
            return initConfig()

        default:
            return state
    }
}

/**
 * Action to be applied to config. Type is one of:
 * 
 * addRide - adds a ride to the config. Must pass ride as well.
 * 
 * removeRide - removes a ride from the config. Does nothing if ride was not in config. Must pass ride. Only the rideName is considered when removing, so state can be whatever.
 * 
 * changePark - changes the park containing the rides. This will reset the config. Must pass park and can pass a ride too to allow for atomic updates. Think of this like changing the namespace
 * of the ride configs, to specify, for example, what corkscrew is being alerted on.
 *  
 * reset - removes all rides and the park from the config.
 * 
 * loadConfig - copies a config into store. Must pass oldConfig.
 */
export type action = {
    type: 'addRide' | 'removeRide' | 'reset' | 'changePark' | 'loadConfig',
    //Ride used for adding operations
    ride?: {
        rideName: string,
        alertOn: alertOption
    },
    park?: string,
    oldConfig?: AlertConfig
}