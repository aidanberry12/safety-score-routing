from operator import truediv
import geopy
from numpy.core.numeric import full
import pandas as pd
import geopy.distance


df_CO = pd.read_json('CO_Sample_hotspots.json')
df_full = pd.read_json('Full_Data_hotspots.json')

under_one_mile = 0
index = 0

for CO_index, CO_row in df_CO.iterrows():
    print('CO Loop ', index)
    index += 1
    coords_CO = (CO_row['centroid_latitude'], CO_row['centroid_longitude'])

    for full_index, full_row in df_full.iterrows():
        coords_full = (full_row['centroid_latitude'], full_row['centroid_longitude'])
        distance = geopy.distance.great_circle(coords_CO, coords_full).miles
        if distance <= 1:
            under_one_mile += 1

print('Under one mile: {}%'.format(round(under_one_mile/258 * 100)))
