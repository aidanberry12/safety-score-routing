import psycopg2
import sys
import datetime
import json
import csv

# This file reads in cluster data into a SQL table
def main():
	if (len(sys.argv) != 7):
		print("Invalid Usage!")
		print("python ingest_cluster_data.py [dbname] [username] [host] [port] [password] [json path]")
		return

	null, database, user, host, port, password, jsonPath = sys.argv

	conn = psycopg2.connect(f'dbname={database} user={user} host={host} port={port} password={password}')
	cur = conn.cursor()

	with open(jsonPath, newline='') as file:
		data = json.load(file)

		query = 'INSERT INTO clusters (cluster_id, centroid, severity) VALUES'
		for cluster in data:
			query += f" ({cluster['cluster_id']}, 'POINT({round(cluster['centroid_longitude'], 7)} {round(cluster['centroid_latitude'], 7)})', {cluster['avg_severity']}),"
		query = query[:-1] + ';'
		# print(query)
		cur.execute(query)

		conn.commit()

	cur.close()
	conn.close()

main()