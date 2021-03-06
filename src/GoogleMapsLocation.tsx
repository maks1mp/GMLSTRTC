import React, {useCallback, useEffect, useState} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {GoogleMap, useJsApiLoader, Marker} from '@react-google-maps/api';
import PlacesAutocomplete, {AutocompletePrediction, geocodeByPlaceId} from 'react-places-autocomplete';

interface AutocompletePredictionSelect {
  label: string;
  value: Partial<AutocompletePrediction>
}

interface MapLocation {
  lat: number;
  lng: number;
}

const INITIAL_LOCATION: AutocompletePredictionSelect = {
  label: 'London, UK',
  value: {
    place_id: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
    description: 'London, UK',
  }
}

const geocodeByLatLng = (latLng: MapLocation): Promise<any> => {
  const geocoder = new window.google.maps.Geocoder();
  const { OK } = window.google.maps.GeocoderStatus;

  return new Promise((resolve, reject) => {
    geocoder.geocode(
      { location: latLng },
      (
        results,
        status,
      ) => {
        if (status !== OK) return reject(status);

        return resolve(results);
      }
    );
  });
};

const getCachedGeo = (): MapLocation | null => {
  const geo = localStorage.getItem('geo')

  if (geo) {
    return JSON.parse(geo)
  }

  return null
}

const getCachedAddress = (): AutocompletePredictionSelect | null => {
  const prediction = localStorage.getItem('prediction')

  if (prediction) {
    return JSON.parse(prediction) as AutocompletePredictionSelect
  }

  return null
}
const params = new URLSearchParams(window.location.search);
const key = params.get('key') as string;
const libraries = params.get('libraries') as string;

const googleMapsApiKey = `${key}&libraries=${libraries}`

export default function GoogleMapsLocation() {
  const {isLoaded} = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey
  })

  const [search, setSearch] = useState<string>(() => getCachedAddress()?.label ?? '')
  const [map, setMap] = React.useState(null)
  const [address, setAddress] = useState<AutocompletePredictionSelect | null>(() => getCachedAddress())
  const [center, setCenter] = useState<MapLocation | null>(() => getCachedGeo());
  const [position, setPosition] = useState<MapLocation | null>(() => getCachedGeo())

  const setGeo = useCallback((geo: MapLocation) => {
    localStorage.setItem('geo', JSON.stringify(geo))

    setCenter(geo)
    setPosition(geo)
  }, [])

  const setGeoFromPrediction = useCallback(async (prediction: AutocompletePredictionSelect) => {
    setAddress(prediction)
    setSearch(prediction.label)

    const [geocode] = await geocodeByPlaceId(prediction!.value!.place_id!)

    const lng = geocode.geometry.location.lng()
    const lat = geocode.geometry.location.lat()

    setGeo({lng, lat} as MapLocation)

    localStorage.setItem('prediction', JSON.stringify(prediction))
  }, [setGeo])

  const onLoad = React.useCallback(function callback(map) {
    setMap(map)
  }, [])

  const onUnmount = React.useCallback(function callback(map) {
    setMap(null)
  }, [])

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!getCachedAddress() || !getCachedGeo()) {
      const geoSuccess: PositionCallback = (position) => {
        const {latitude: lat, longitude: lng} = position.coords

        geocodeByLatLng({lat, lng}).then(([response]) => {
          setGeoFromPrediction({
            label: response.formatted_address,
            value: {
              place_id: response.place_id,
              description: response.formatted_address
            }
          })
        }).catch(() => {
          setGeoFromPrediction(INITIAL_LOCATION)
        })
      }
      const geoError: PositionErrorCallback = (error) => {
        setGeoFromPrediction(INITIAL_LOCATION)
      };

      navigator.geolocation.getCurrentPosition(geoSuccess, geoError);
    }
  }, [setGeo, setGeoFromPrediction, isLoaded])

  return (
    <div className="h-screen w-screen relative">
      <div className="fixed left-0 right-0 top-0 h-12 z-10 p-0.5">
        {map && (
          <PlacesAutocomplete
            value={search}
            onChange={value => {
              setSearch(value)
            }}
            onSelect={async (label: string, placeId: string) => {
              setGeoFromPrediction({
                label,
                value: {
                  description: label,
                  place_id: placeId
                }
              })
            }}
          >
            {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
              <div>
                <input
                  {...getInputProps({
                    placeholder: 'Search Places ...',
                    className: 'location-search-input',
                    style: {
                      width: '100%'
                    }
                  })}
                />
                <div className="autocomplete-dropdown-container">
                  {loading && <div>Loading...</div>}
                  {suggestions.map(suggestion => {
                    const className = suggestion.active
                      ? 'suggestion-item--active'
                      : 'suggestion-item';
                    // inline style for demonstration purpose
                    const style = suggestion.active
                      ? { backgroundColor: '#fafafa', cursor: 'pointer' }
                      : { backgroundColor: '#ffffff', cursor: 'pointer' };
                    return (
                      <div
                        {...getSuggestionItemProps(suggestion, {
                          className,
                          style,
                        })}
                      >
                        <span>{suggestion.description}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </PlacesAutocomplete>
        )}
      </div>
      {isLoaded ? (
        <>
          {(!center || !position) && (
            <div className="flex justify-center items-center h-screen">
              <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16 mr-4" />
              <div>
                Loading...
              </div>
            </div>
          )}
          {center && position && (
            <AutoSizer>
              {(({width, height}) => (
                <div className="pt-11">
                  <GoogleMap
                    mapContainerStyle={{
                      width,
                      height
                    }}
                    center={center || undefined}
                    zoom={10}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                  >
                    {position && (
                      <Marker
                        onLoad={onLoad}
                        position={position}
                      />
                    )}
                  </GoogleMap>
                  <div className="fixed left-0 bottom-0 p-3">
                    <button
                      onClick={async () => {
                        console.log('address >>', address)
                        console.log('geo >>', await geocodeByPlaceId(address?.value.place_id!))
                      }}
                      className="bg-[#000] text-[#fff] font-bold text-white px-4 py-3 transition duration-300 ease-in-out">
                      Log to console
                    </button>
                  </div>
                </div>
              ))}
            </AutoSizer>
          )}
        </>
      ) : null}
    </div>
  )
}
