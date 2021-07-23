/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import React from 'react'
import { FaBars } from 'react-icons/fa'

type props = { onClick: React.MouseEventHandler<HTMLButtonElement> }

const Hamburger: React.FC<props> = ({ onClick }) => {//TODO style and position correctly
    return (
        <div className="hamburger">
            <button onClick={onClick} aria-label="Menu open button">
                <FaBars />
            </button>
        </div>
    )
}

export default Hamburger
