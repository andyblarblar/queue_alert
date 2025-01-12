/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file Contains the sidebar used for navigation.
 */

import { FaGithub, FaShareAlt } from 'react-icons/fa'
import { Menu, MenuItem, ProSidebar, SidebarContent, SidebarFooter, SidebarHeader } from 'react-pro-sidebar'
import { useMediaQuery } from 'react-responsive'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'

type props = {
    toggled: boolean,
    /**Called when bar is dismissed while in mobile mode */
    onToggle?: (value: boolean) => void,
    /**Called when an item is clicked */
    onItemClick?: () => void
}

/**
 * Contains the sidebar used for navigation.
 */
const SideBar: React.FC<props> = ({ toggled, onToggle, onItemClick }) => {
    const onMobile = useMediaQuery({ query: "(max-width: 1200px)" })
    const onTablet = useMediaQuery({ query: "(min-width: 460px) and (max-width: 1200px)" })

    return (
        <ProSidebar breakPoint="xl" toggled={toggled} width={onTablet ? '22.5vw' : (onMobile ? '60vw' : '9vw')} onToggle={onToggle}>
            <SidebarHeader>
                <Menu iconShape="square">
                    <MenuItem >
                        <Link to="/" onClick={onItemClick}>
                            <img src="icons/apple-icon-60x60.png" alt="queue alert logo" />
                        </Link>
                    </MenuItem>
                </Menu>
            </SidebarHeader>

            <SidebarContent>
                <Menu iconShape="square">
                    <MenuItem ><Link to="/" onClick={onItemClick}>Home</Link></MenuItem>
                    <MenuItem ><Link to="/about" onClick={onItemClick}>About</Link></MenuItem>
                </Menu>
            </SidebarContent>

            <SidebarFooter>
                <Menu iconShape="square">
                    <MenuItem >
                        <a href="https://github.com/andyblarblar/queue_alert" aria-label="Github repo link">
                            <FaGithub size='30' opacity='0.9' />
                        </a>

                        <div style={{ display: "inline", marginLeft: "7px" }} onClick={shareSiteIfPossible}>
                            <FaShareAlt size='29' opacity='0.9' />
                        </div>

                        <span style={{marginLeft: "5px", opacity: "0.6", fontSize: "xx-small"}}>v2.1.1</span>
                    </MenuItem>
                    <MenuItem id="designed-by">
                        <a href="https://ealovega.dev" target="_" rel="noreferrer noopener">Made with 💜 by Andrew Ealovega</a>
                    </MenuItem>
                </Menu>
            </SidebarFooter>
        </ProSidebar>
    )
}

/**Attempts to share the site over the share API.*/
function shareSiteIfPossible() {
    //Most browsers don't have the share api yet.
    if ("share" in navigator) {
        navigator.share({ text: "Check out Queue Alert!", url: "https://qalert.ealovega.dev" }).then()
    }
    //Fallback to clipboard and prompt toast announcing such.
    else if ("clipboard" in navigator) {
        (navigator as Navigator).clipboard.writeText(`https://qalert.ealovega.dev`).then()
        toast.success('Copied link to clipboard!')
    }
}

export default SideBar
