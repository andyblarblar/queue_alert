
/*
 * Copyright (c) 2021. Andrew Ealovega
 */

type props = {}
/**Wraps another element in a spinner.*/
const Spinner: React.FC<props> = ({ children }) => {
    return (
        <div className="spinner">
            <div className="spinner-svg-container">
                {children}
            </div>
        </div>
    )
}

export default Spinner
