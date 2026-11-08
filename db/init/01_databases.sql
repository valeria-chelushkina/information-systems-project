CREATE ROLE app_ticketing LOGIN PASSWORD 'dev_ticketing_pw';
CREATE ROLE app_catalog   LOGIN PASSWORD 'dev_catalog_pw';
CREATE ROLE app_notify    LOGIN PASSWORD 'dev_notify_pw';

CREATE DATABASE db_ticketing OWNER app_ticketing;
CREATE DATABASE db_catalog   OWNER app_catalog;
CREATE DATABASE db_notify    OWNER app_notify;
