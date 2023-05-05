CREATE TABLE IF NOT EXISTS REGISTRATIONS
(
    endpoint          TEXT NOT NULL,
    subscription_info TEXT NOT NULL,
    created_at        DATE NOT NULL,
    PRIMARY KEY (endpoint)
);

CREATE TABLE IF NOT EXISTS CONFIGS
(
    endpoint TEXT NOT NULL,
    park     TEXT NOT NULL,
    PRIMARY KEY (endpoint),
    FOREIGN KEY (endpoint) REFERENCES REGISTRATIONS (endpoint) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS RIDEALERTS
(
    endpoint TEXT NOT NULL,
    ridename TEXT NOT NULL,
    alerton  TEXT NOT NULL CHECK ( alerton in ('open', 'closed', 'wait') ),
    -- Null if alerton is not wait, set otherwise
    wait     INTEGER CHECK ( wait is null AND alerton not in ('wait') OR wait is not null AND alerton in ('wait')),
    PRIMARY KEY (endpoint, ridename),
    FOREIGN KEY (endpoint) REFERENCES CONFIGS (endpoint) ON DELETE CASCADE ON UPDATE CASCADE
)