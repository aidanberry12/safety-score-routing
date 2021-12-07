#!/bin/bash

export DATABASE_URL='postgres://team_175:secure_175@137.184.78.199:31802/cse6242'
FLASK_APP=app.py FLASK_ENV=development flask run