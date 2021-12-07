from psycopg2 import OperationalError
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from io import StringIO
import pandas as pd
import psycopg2
import sys
from data_cleaning import run_file, outlier_treatment, data_preprocessing

# Define connect function for PostgreSQL database server
def connect(user,password,host,database,port):
    conn = None
    try:
        print('Connecting to the PostgreSQL...')
        conn = psycopg2.connect(f'dbname={database} user={user} host={host} port={port} password={password}')
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("Connection succesful...")
    except OperationalError as err:
        #passing exception to function
        show_psycopg2_exception(err)
        # Set the connection to 'None' in cse of error
        conn = None
    return conn

def show_psycopg2_exception(err):
    # get detaiul about the exception
    err_type, err_obj, traceback = sys.exc_info()
    # get the line number when exception occured
    line_n = traceback.tb_lineno
    # print the connect() error
    print ("\npsycopg2 ERROR:", err, "on line number:", line_n)
    print ("psycopg2 traceback:", traceback, "-- type:", err_type) 
    # psycopg2 extensions.Diagnostics object attribute
    print ("\nextensions.Diagnostics:", err.diag)    
    # print the pgcode and pgerror exceptions
    print ("pgerror:", err.pgerror)
    print ("pgcode:", err.pgcode, "\n")

def create_table(cursor):
    try:
        # Dropping table iris if exists
        cursor.execute("DROP TABLE IF EXISTS accidents_table;")
        sql = '''CREATE TABLE accidents_table(
        ID varchar,
        Severity integer,
        Start_Time timestamp,
        End_Time timestamp,
        Distance_mi_ real,
        Number real,
        Street varchar, 
        Side varchar,
        City varchar,
        County varchar,
        State varchar,
        Zipcode varchar,
        Country varchar,
        Timezone varchar,
        Airport_Code varchar,
        Weather_Timestamp date,
        Wind_Chill_F_ real,
        Humidity_percent_ real,
        Pressure_in_ real,
        Wind_Direction varchar,
        Wind_Speed_mph_ real,
        Precipitation_in_ real,
        Weather_Condition varchar,
        Amenity boolean,
        Bump boolean,
        Crossing boolean,
        Give_Way boolean,
        Junction boolean,
        No_exit boolean,
        Railway boolean,
        Roundabout boolean,
        Station boolean,
        Stop boolean,
        Traffic_Calming boolean,
        Traffic_Signal boolean,
        Turning_Loop boolean,
        Sunrise_Sunset boolean,
        Civil_Twilight boolean,
        Nautical_Twilight boolean,
        Astronomical_Twilight boolean,
        Temperature_F_ real,
        Visibility_mi_ real,
        StartLoc geometry,
        EndLoc geometry,
        Cluster int,
        cluster_severity real
        )'''
        # Creating a table
        cursor.execute(sql)
        print("accidents_table was created successfully...")  
    except OperationalError as err:
        # pass exception to function
        show_psycopg2_exception(err)
        # set the connection to 'None' in case of error
        conn = None

def execute_query(conn, query):
    """ Execute a single query """

    ret = 0 # Return value
    cursor = conn.cursor()
    try:
        cursor.execute(query)
        conn.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        print("Error: %s" % error)
        conn.rollback()
        cursor.close()
        return 1

    # If this was a select query, return the result
    if 'select' in query.lower():
        ret = cursor.fetchall()
    cursor.close()
    return ret

# Define function using copy_from() with StringIO to insert the dataframe
def copy_from_dataFile_StringIO(conn, datafrm, table):
    
  # save dataframe to an in memory buffer
    buffer = StringIO()
    datafrm.to_csv(buffer, header=False, index = False)
    buffer.seek(0)
    
    cursor = conn.cursor()
    try:
        cursor.copy_from(buffer, table, sep=",",null='None')
        print("Data inserted using copy_from_datafile_StringIO() successfully....")
    except (Exception, psycopg2.DatabaseError) as err:
        # pass exception to function
        show_psycopg2_exception(err)
        cursor.close()

if  __name__ == "__main__":
    conn = connect(user='bbor',password='bborrobb', host='137.184.78.199', database='cse6242', port='31802')
    # We set autocommit=True so every command we execute will produce results immediately.
    conn.autocommit = True
    cursor = conn.cursor()

    accidents_df = run_file('US_Accidents_Dec20_updated.csv')

    accidents_df_preprocessing = data_preprocessing(accidents_df)

    create_table(cursor)

    copy_from_dataFile_StringIO(conn, accidents_df_preprocessing, 'accidents_table')

    # Check that the values were indeed inserted
    query = execute_query(conn, '''select count(*) 
                                from accidents_table;
                                ''')
    print("Number of rows in the table = %s" % query)
