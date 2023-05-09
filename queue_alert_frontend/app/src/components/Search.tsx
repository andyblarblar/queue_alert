import React from "react"
import {FaSearch} from "react-icons/fa"

export type SearchProps = {
    /**
     * Called when user inputs text
     * @param input Current search input
     */
    onChange: (input: string) => void,
    /**
     * Default text
     */
    placeholderText?: string
}

/**
 * A generic searchbar
 */
export const SearchBar: React.FC<SearchProps> = ({onChange, placeholderText}: SearchProps) => {
    return (
        <div className="search-container">
            <div className="search-icon">
                <FaSearch/>
            </div>
            <input onInput={(event) => {
                onChange((event.target as HTMLInputElement).value)
            }} placeholder={placeholderText ?? "Search"} className={"searchbar"}/>
        </div>
    )
}