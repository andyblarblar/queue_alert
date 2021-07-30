/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import { useMediaQuery } from "react-responsive"
import Spinner from "./Spinner"

/**Spinner with QA logo. */
function QASpinner() {
    const isDesktop = useMediaQuery({ query: "(min-width: 1200px)" })

    const getCorrectImg = () => {
        //Use a much larger icon on desktop
        if (isDesktop) {
            return "/icons/queueLogo@0,33x.png"
        }
        else {
            return "/icons/android-icon-192x192.png"
        }
    }

    return (
        <Spinner>
            <img src={getCorrectImg()} alt="loading spinner" ></img>
        </Spinner>
    )
}

export default QASpinner
