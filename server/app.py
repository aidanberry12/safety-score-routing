from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from urllib.parse import urlparse
import psycopg2
import os
import sys
import time

from calculations import calculateSafetyScore, start_coord_one_call_API

# CONFIG VALUES
columns = "*" # String describing which columns we want from every accident
route_check_radius = '0.0001' # units are lat/lon
connectCmd = f'dbname=cse6242 user=bbor host=127.0.0.1' #default

if (os.environ['DATABASE_URL']):
	res = urlparse(os.environ['DATABASE_URL'])
	connectCmd = f'dbname={res.path[1:]} password={res.password} user={res.username} host={res.hostname} port={res.port}'

# Initialize the Flask object to attach our routes to
app = Flask(__name__)

# Connect to the PostgreSQL database
conn = psycopg2.connect(connectCmd)
cur = conn.cursor()

# Setup CORS (security features)
cors = CORS(app, origins=["http://localhost:3000", "https://safetyrouter.robbwdoering.com"])

def getRouteCheckRadius(distance):
	return '0.0001' if distance < 10 else '0.001'
##
# Gets a list of accidents along the given route.
# NOTE: This isn't a request-able application route, just a utility function for other routes.
# Output: A tuple:
#   0 is a list of accident arrays, each containing all columns in order
#   1 is a list of cluster arrays of format [id, severity]
#
def findIncidentsAlongRoute(route, route_check_radius):
	if (route is None or len(route) == 0):
		return []
	# Find the relevant accidents
	multipoint = 'MULTIPOINT('
	for point in route:
		multipoint += f'{point[1]} {point[0]}, ' # reverse order - postgis wants lon before lat
	multipoint = multipoint[:-2] + ')' # remove final comma, add closing paren

	startProfileTime = time.time()
	query = f"SELECT {columns} FROM accidents_table WHERE ST_DWithin(ST_GeomFromText('{multipoint}'), StartLoc, {route_check_radius})"
	cur.execute(query)
	accidents = cur.fetchall()

	startProfileTime = time.time()
	query = f"SELECT (cluster_id, severity) FROM clusters WHERE ST_DWithin(ST_GeomFromText('{multipoint}'), centroid, {route_check_radius})"
	cur.execute(query)
	clusters = cur.fetchall()

	return [accidents, clusters]

## 
# Takes in some routes as defined by lists of points along the route, and returns a "safety score" for each,
# taking into account current conditions (weather and time of day).
# Input: Json object with three fields:
# 	'routes' 3D array of form [ [ [lat, lon], [lat2, lon2], ...], ...] describing 1-3 routes
#	'distances' is a 1D array of 1-3 floats describing the length of each route in miles
# 	'options' is an OPTIONAL object: details TBD
# Output: A float score 0.0-10.0 describing the relative safety of each passed route 
@app.route("/score-routes", methods=['POST'])
def scoreRoutes():
	data = request.json

	# Validate message from client
	if data is None:
		print("No data")
		os.abort(401)

	# Calculate and return scores
	scores = []
	allAccidents = []
	current_conditions = start_coord_one_call_API(data['routes'][0][0][0], data['routes'][0][0][1])
	distances = data['distances']

	for idx, route in enumerate(data['routes']):
		# Fetch intersection accidents
		score = 8.0 #No accident / hotspots along route
		accidents, clusters = findIncidentsAlongRoute(route, getRouteCheckRadius(distances[idx]))

		# Fetch population density 
		# zipcode = accidents[0][11]
		# if ('-' in zipcode):
		# 	zipcode = zipcode.split('-')[0]
		# cur.execute(f"SELECT density FROM zipcode_density WHERE zip='{zipcode}';")
		# density = cur.fetchone();
		# if (density is None):
		# 	#https://en.wikipedia.org/wiki/List_of_states_and_territories_of_the_United_States_by_population_density
		# 	density = 92.0
		# else:
		# 	density = density[0]

		if len(accidents) > 0:
			score = calculateSafetyScore(route, accidents, current_conditions, distances[idx])
		scores.append(score)
		allAccidents.append(accidents)

	return jsonify({ 'scores': scores, 'accidents': allAccidents, 'conditions': current_conditions })

## 
# Accidents endpoint returns data for all the accidents found within a given area,
# as defined by the bounding box between two points.
# Input: JSON object with a clusterId (int) field 
# Output: A (paginated?) list of accidents is returned to the client as a JSON array
@app.route("/accidents/cluster", methods=['POST'])
def accidentsCluster():
	clusterId = request.json['clusterId']

	query = 'SELECT * FROM accidents_table WHERE Cluster = %s'
	cur.execute(query, (clusterId,))
	accidents = cur.fetchall()

	if (accidents is None):
		os.abort(404)

	# return jsonify([list(entry) for entry in accidents])
	return jsonify(accidents)

## 
# Accidents endpoint returns data for all the accidents found within a given area,
# as defined by the bounding box between two points.
# Input: JSON array containing two or more points (lat/lon) to draw a bounding box around
# Output: A (paginated?) list of accidents is returned to the client as a JSON array
@app.route("/accidents/box", methods=['POST'])
def accidentsBox():
	p1 = request.json['p1']
	p2 = request.json['p2']

	lats = [p1['lat'], p2['lat']]
	lngs = [p1['lng'], p2['lng']]
	lats.sort()
	lngs.sort()

	query = f'SELECT {columns} FROM accidents_table WHERE StartLoc && ST_MakeEnvelope({lngs[0]}, {lats[0]}, {lngs[1]}, {lats[1]}, 4326)'
	cur.execute(query)
	accidents = cur.fetchall()

	if (accidents is None):
		os.abort(404)

	return jsonify(accidents)

## 
# Accidents endpoint returns data for all the accidents found along a given route.
# @param corner1 the top left corner of the bounding box
# @param corner2 the bottom right corner
@app.route("/accidents/route", methods=['POST'])
def accidentsRoute():
	if request.json is None or request.json['route'] is None:
		os.abort(400)

	accidents, clusters = findIncidentsAlongRoute(request.json['route'], route_check_radius)

	return jsonify({ 'accidents': accidents, 'clusters': clusters })

@app.route("/")
def index():
	return "CSE6242 Team 175 Backend - Frontend at https://safetyrouter.robbwdoering.com"

if __name__ == "__main__":
	port = int(os.environ.get('PORT', 5000))
	app.run(host='127.0.0.1', port=port, debug=True, threading=True)

