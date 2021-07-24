
/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**Error shown when a connection to the server fails.*/
function ServerError() {
    return (
        <div className="error-container">
            <div className="error-emote">
                :(
            </div>

            <p className="error-msg">It looks like there was an error contacting the server. I'll do my best to get this fixed!</p>
        </div>
    )
}

export default ServerError
