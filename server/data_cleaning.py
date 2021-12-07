import pandas as pd
import numpy as np
from timezonefinder import TimezoneFinder

def run_file(path):
    df = pd.read_csv(path)

    return df

def outlier_treatment(df, lq = None, uq = None, cols=None):
    
    if lq is None:
        lq = 0.01
    if uq is None:
        uq = 0.99
    if cols is None:
        cols = list(df.select_dtypes(include='float').columns)

    Q1 = df[cols].quantile(lq)
    Q3 = df[cols].quantile(uq)
    IQR = Q3 - Q1

    df_filtered = df[~((df[cols] < (Q1 - IQR)) |(df[cols] > (Q3 + 1.1 * IQR))).any(axis=1)]
    
    return df_filtered

def time_zone_missing_values(df):

    # fill in missing timezones based on lat/long coordinates
    tf = TimezoneFinder()
    df['Timezone'] = df.apply(lambda row: tf.timezone_at(lng=row['Start_Lng'],lat=row['Start_Lat']) if pd.isna(row['Timezone']) else row['Timezone'], axis =1)
    
    # standardize timezone names used in pytz package
    timezone_map = {'US/Eastern':'America/New_York', 'US/Central':'America/Chicago', 'US/Mountain':'America/Denver', 'US/Pacific': 'America/Los_Angeles'}
    df['Timezone'].replace(timezone_map, inplace = True)

    # drop points with timezone not in the US
    df = df[df['Timezone'] != 'other']

    # drop missing timestamps
    df = df[df['Timezone'].notna()]
    
    return df

def data_preprocessing(df):
    print("[data_preprocessing] begin")
    df_outliers = outlier_treatment(df, lq = 0.01, uq = 0.99,cols=['Wind_Speed(mph)', 'Temperature(F)', 'Visibility(mi)', 'Precipitation(in)'])

    df_outliers['Description'] = df_outliers['Description'].apply(lambda x:x.replace('%','percent').replace(' ','_').replace('.','_'))

    df_outliers = time_zone_missing_values(df_outliers)

    df_outliers_description_series = df_outliers['Description']

    df_outliers_test_drop = df_outliers.drop('Description',axis=1)

    df_outliers_test_drop = df_outliers_test_drop.where(pd.notnull(df_outliers_test_drop), 'None')

    df_outliers_test_drop = df_outliers_test_drop.applymap(lambda x:x.lstrip() if isinstance(x,str) else x)

    df_outliers_test_drop = df_outliers_test_drop.applymap(lambda x:x.rstrip() if isinstance(x,str) else x)

    data = df_outliers_test_drop

    # Translate float lat/lon values into strings that can be parsed into PostGIS Geometry objects
    data['StartLoc'] = data.apply(lambda row: f'POINT({round(row["Start_Lng"], 7)} {round(row["Start_Lat"], 7)})', axis=1)
    data['EndLoc'] = data.apply(lambda row: f'POINT({round(row["End_Lng"], 7)} {round(row["End_Lat"], 7)})', axis=1)

    # Translate Day/Night into booleans
    data['Sunrise_Sunset'] = data.apply(lambda row: row["Sunrise_Sunset"] == "Day", axis=1)
    data['Civil_Twilight'] = data.apply(lambda row: row["Civil_Twilight"] == "Day", axis=1)
    data['Nautical_Twilight'] = data.apply(lambda row: row["Nautical_Twilight"] == "Day", axis=1)
    data['Astronomical_Twilight'] = data.apply(lambda row: row["Astronomical_Twilight"] == "Day", axis=1)

    # Assign cluster to accident record
    cluster_assignments = pd.read_csv('clust_assigns.csv')
    # POINT(-105.0252 39.72929), 1249
    data = pd.merge(data, cluster_assignments, on='StartLoc', how='left')
    data['Cluster'] = data['Cluster'].fillna(-1)
    data['Cluster'] = data['Cluster'].astype(int)

    # Assign cluster severity to accident record
    severity = pd.read_json('accident_hotspots_updated.json')
    severity = severity.drop(['centroid_latitude','centroid_longitude'] , axis=1)
    data = pd.merge(data, severity, left_on='Cluster', right_on='cluster_id', how='left')
    data['avg_severity'] = data['avg_severity'].fillna(0)

    data = data.drop('cluster_id', axis=1)
    data = data.drop(data.columns[0], axis=1)
    data = data.drop('Start_Lat', axis=1)
    data = data.drop('Start_Lng', axis=1)
    data = data.drop('End_Lat', axis=1)
    data = data.drop('End_Lng', axis=1)

    print(data.head())
    print("[data_preprocessing] close")

    return data 

if  __name__ == "__main__":
    
    accidents_df = run_file('US_Accidents_Dec20_updated.csv')
    accidents_df = accidents_df.drop(accidents_df.columns[0], axis=1)
    accidents_df_preprocessing = data_preprocessing(accidents_df)

