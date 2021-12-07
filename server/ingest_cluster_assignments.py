import pandas
import time
import json
import csv

total_accidents = 1178659 
total_locations = 396771
bin_size = 1000

# This file creates clust_assigns.csv which has Accident->Cluster mapping
def main():
	startTime = time.time()

	with open('cluster_assignments_updated.json', newline='') as file:
		with open('clust_assigns.csv', 'w') as outFile:
			data = json.load(file)
			writer = csv.writer(outFile)
			writer.writerow(("StartLoc", "Cluster"))
			locations = {}
			count = 0
			for cluster in data:
				if (count == 0):
					count += 1
					continue
				if count % 100000 == 0:
					elapsed = time.time() - startTime
					diff = total_accidents - count;
					print(f"Locations - {count} in {elapsed}s, estimated remaining: {elapsed / count * (diff)}s")
				count += 1

				# We speed this up by rounding to 5 places, AKA 1.1m
				location = f"POINT({round(cluster['longitude'], 5)} {round(cluster['latitude'], 5)})"

				if (location not in locations):
					locations[location] = (int(cluster['cluster_assignment']))
			print(f"Processed {count} in {time.time() - startTime}s. Found {len(locations.keys())} unique locations")

			for location in locations:
				writer.writerow((location, locations[location]))
main()