# Driver Safety Routing and Accident Transparency

**CSE6242 Project Team #175**

_Aidan Berry, Chris Kim, Juan Hurtado, Meena Chockalingam, Robb Doering, Steven Maloney_ 

**NOTE:** This file must be translated to README.txt before final submission.

## 1. Description
_"Describe the package in a few paragraphs."_

This project consists of three components - a PostgresSQL database, a Flask Python server that accesses the database and serves an API, and a React single page client that shows routes and visualizations to the end user.

### Client
The client was created using [create-react-app](https://github.com/facebook/create-react-app), which initializes a basic React SPA directory structure, sets up a system for running the app in a local development server or building it into production-ready deployables, and configures a few tools required for modern Javascript ES6  development, namely [Webpack](https://webpack.js.org/) and [Babel](https://babeljs.io/). From here dependencies are loaded as NPM modules, with the following being the most important:

- [d3.js](https://d3js.org/) is used for visualizations
- [leaflet.js](https://leafletjs.com/) is used for an interactive map
- The [material-ui](https://mui.com/) framework is used for Google-like UI elements

When deployed, the client is built by this NPM system and delivered as a [static](https://www.staticapps.org/articles/defining-static-web-apps/), [minified](https://en.wikipedia.org/wiki/Minification_(programming)) application via AWS' offering for that use case, the popular [S3 bucket](https://aws.amazon.com/s3/). 

#### Features
- Routing provided by Google Maps API

- Interactive map displaying:
  1. Accident hotspots
  2. Route(s) for selected start and destination addresses.

- Statistics on a selected hotspot:
  1. Center of hotspot
  2. Average severity
  3. Total number of accidents in hotspot
  4. Percent of accidents occuring in rain
  5. Percent of accidents occuring at night

- Statistics on a selected route:
  1. Different provided routes
  2. Safety Score
  3. Estimated duration of route
  4. Length of route
  5. Average severity
  6. Total number of accidents along routes
  7. Percent of accidents occuring in rain
  8. Percent of accidents occuring at night

- Graphs for hotspot or route:
  1. Accident frequency per month
  2. Accidents per severity
  3. Accidents per temperature range
  4. Accidents per visibility index

### Server
The backend is built and deployed to a [persistent cloud server](https://www.digitalocean.com/) via a "heroku-like" opensource tool called [Dokku](https://dokku.com/). This does almost all the heavy lifting of the deployment work by allowing us to prompt rebuild/redeploy operations with a simple `git push`, and creating a publicly accessible web server via [NGINX](https://www.nginx.com/) as a base and [Gunicorn](https://gunicorn.org/) as middleware.

#### Database
The database can be accessed via an API located at `https://cse6242.robbwdoering.com` in two ways, first through a box method which takes two coordinate points and creates a box returning all accidents inside that box.  The second is by taking in a route produced from the Google Maps API and returning the accidents along that route.  Postgis facilitates the querying of the database for accidents in the box or along the route.


## 2. Installation
_"How to install and setup your code."_

We have setup our application to run on the public web already, so the easiest way to install it is to access the site  https://safetyrouter.robbwdoering.com/  from your browser. If you wish to run it on your local machine instead using Node servers attached to localhost, the instructions available in sections 2.1-2.3 below. Please contact [Robb](robb.doering@gatech.edu) or [Meena](mchockalingam3@gatech.edu) if you run into issues when setting up in local.

### 2.1 Environment Requirements
Begin by installing the code, and navigate in your command line to the root directory of the project.

#### Server Requirements
- [Python](https://www.python.org/downloads/) >= 3.6
- `pip install -r server/requirements.txt` to install python dependencies
- The database requires the installation of [PostgreSQL](https://www.postgresql.org/download/), which should be very simple/already installed, and the installation of the popular geospatial extension [PostGIS](https://postgis.net/install/), which is much more platform intensive and may require a lot of troubleshooting. The general idea is to 1) add the repo to your system's access list, 2) install postgis and its dependencies using your OS's dependency manager, and 3) login to your PostgreSQL database and enable PostGIS with the command `CREATE EXTENSION postgis;`. This is all extremely platform dependent, and the link above should provide guidance for all platforms, but you can find good example instructions for Ubuntu [here](https://computingforgeeks.com/how-to-install-postgis-on-ubuntu-debian/).
- The server requires a set of environment variables - these are platform dependent as well, but a good summary can be found [here](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html). Be careful to set the environment variables, then run the server in that same terminal tab. 
  - DATABASE_URL describes the LIBQ connection url for the database you've setup, which can be built using the information at [this link](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING). do this after step 2.2.
  - PORT describes the port to host the server on - usually 5000 in our case.

#### Client Requirements
- [Node](https://nodejs.org/en/download/) >= 14.0.0
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) >= 5.6
- The client requires NPM environment variables, which are set by creating a `.env` file in the `/client` directory with a `NAME=VAL` entry on each row for every value. All of these values are currently stored in the "Secrets" section of the github repository for this project - graders that wish to set this up locally can contact the team for a copy, or create your own accounts on these cloud provider sites. 
  - REACT_APP_API_IP is the location of the server, which should likely be `http://localhost:5000` for local work or `https://cse6242.robbwdoering.com` for the production version.
  - REACT_APP_GOOGLE_API_KEY is the API key used for Google Maps and Google Places access.
  - REACT_APP_MAPBOX_TOKEN is the API key used for the Mapbox road tiles.

### 2.2 Database Setup
- The platform dependent part of this is getting command line access to your local running PostgreSQL application, usually simply by running the command `psql` - here are some examples for [Mac](https://www.sqlshack.com/setting-up-a-postgresql-database-on-mac/), [Windows](https://www.microfocus.com/documentation/idol/IDOL_12_0/MediaServer/Guides/html/English/Content/Getting_Started/Configure/_TRN_Set_up_PostgreSQL.htm), and [Linux](https://www.enterprisedb.com/postgres-tutorials/how-create-postgresql-database-and-users-using-psql-and-pgadmin), though your setup may vary.
- Once in a PostgreSQL command prompt, create a user with `CREATE USER [USERNAME_HERE] WITH SUPERUSER`, inserting your chosen name.
- Still within the prompt, create a database using `CREATE DATATBASE [NAME_HERE]`, inserting your chosen name.
- Now return to your normal command prompt, and open the file `/notebooks/database_creation.py`, and change the login information on line 136 (`conn = connect(...`) to match your new username and database names. You shouldn't need a password, but that may be platform dependent.
- Download the data into the `notebooks` folder - the original data is available [here](https://www.kaggle.com/sobhanmoosavi/us-accidents/code), and that will work fine, but the final product uses a modified version where we backfilled missing values using a weather API; if a grader wishes to use this slightly more complete data, please contact the team for google drive access. It is too large for hosting on Github. Ensure that the final filename is exactly `US_Accidents_Dec20_updated.csv`.
- Run that script using python, for example `python ./notebooks/database_creation.py`. This will take about 5 minutes, and will create the table and populate it with data from the csv file.
- As mentioned above, you must now set the DATABASE_URL environment variable in the same shell environment you plan on launching the server in.

### 2.2 Start Server
- Navigate to server directory and execute run.sh. If you're on Windows, type `set <var_name>=<value>` on command line from server directory for all variables specified in run.sh. 
- run `python server/app.py` to start the Flask app.
- The server should now be available at `http://localhost:5000` to test via browser or HTTP requests. 

### 2.3 Start Client
- Navigate to the client directory.
- The App requires API_KEY exported as environment variables for using Google Maps and Leaflet maps as mentioned earlier. Please contact the team or create your own API key. 
- Once you have the key, create a `.env` file in `client` directory with the following environment variables exported - REACT_APP_MAPBOX_TOKEN & REACT_APP_GOOGLE_API_KEY
- Run `npm install; npm start` to install all your dependencies if required, and start a local dev server
- The client should now be available at `http://localhost:3000` to test via browser.

## 3. Execution
### When using remote database that is already set up (Preferred option to test our project)
1. Navigate to https://safetyrouter.robbwdoering.com/ in Google chrome.
2. Enter start and destination address. As you start typing, Google Autocomplete helps you fill in the address you are looking for.
3. Click “Calculate Safety Score”.
4. The routes should be displayed in a few seconds on map and the available options will be shown below.
5. The safety score and visualizations will be loaded in the next few seconds.

### If you're setting up PostgresDB in local(not advised)
- Navigate to `project_home_dir/server` directory
- Download the dataset from [here](https://drive.google.com/file/d/1C9pFjXUk7-_3i77uNIZLqdUcjxcpZLmF/view?usp=sharing) into the `project_home_dir/server` directory.
- Run `ingest_cluster_data.py [dbname] [username] [host] [port] [password] [json path]`. `[json path] = accident_hotspots_updated.json` 
- Run `ingest_cluster_assignments.py`.
- Run `database_creation.py`. Make sure you modify the credentials in this file to point to your local database.
- Navigate to hosting address and follow steps 2-5 from the remote database instructions directly above.

### To execute the clustering experiment
- run `python validating_clustering.py` in the clustering_experiment folder.
- The cleaning and clustering of the data has already been done and provided in the .json file.
- Cleaning of the data was the same as used for our project with the addition of limiting the data to only accidents that happened inside of Colorado's borders.
- `CO_Sample_hotspots.json` data comes from https://www.codot.gov/safety/traffic-safety/safety-programs-data/crash-data
- `Full_Data_hotspots.json` comes from the Kaggle dataset https://www.kaggle.com/sobhanmoosavi/us-accidents which we use for our project. For this experiment, only the accidents that occured in Colorado were used.
## 4. Demo Video
[TODO]
