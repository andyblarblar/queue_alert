/*
 * Copyright (c) 2021. Andrew Ealovega
 */

type props = { title: string, children?: React.ReactNode; }

/**An FAQ block.*/
const Faq: React.FC<props> = ({ title, children }) => {
    return (
        <div className="Faq-question">
            <div className="Faq-title">
                {title}
            </div>

            <div className="Faq-child">
                {children}
            </div>
        </div>
    )
}

export default Faq
