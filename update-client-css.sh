#!/bin/bash

USAGE="$0: usage is: $0 lc-client-semver"
BASE_URL="https://d35x2co4ayvx2v.cloudfront.net/build/LC_CLIENT_SEMVER/css/index.css"

if [ $# -lt 1 ]
then
	echo $USAGE
	exit 2
fi

VERSION=$1

NEW_CSS_FILE=lc-client.$VERSION.css

URL=`echo $BASE_URL | sed "s/LC_CLIENT_SEMVER/$VERSION/"`
curl -o $NEW_CSS_FILE $URL

if [ $? -eq 0 ]
then
	ln -sf $NEW_CSS_FILE lib/public/lc-client.css
fi

ls -lF lib/public/lc-client*.css
