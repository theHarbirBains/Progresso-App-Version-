import CoreLocation
import ExpoModulesCore
import MapKit

// Gyms from Apple Maps, searched on the phone (MapKit): those near a point, or those matching a
// name, both kept to fitness centres. What's found goes back to the app as plain values -- its
// name, address, where it is and how far from the point given -- and nothing is kept here. The
// point searched from is the phone's own, sent only to Apple's MapKit, never to Progresso.
public class GymSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GymSearch")

    // Gyms within `radiusMeters` of a point, nearest first.
    AsyncFunction("nearby") { (latitude: Double, longitude: Double, radiusMeters: Double, promise: Promise) in
      let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
      let request = MKLocalPointsOfInterestRequest(center: center, radius: max(100, min(radiusMeters, 50_000)))
      request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.fitnessCenter])
      MKLocalSearch(request: request).start { response, error in
        if let error = error {
          promise.reject("E_GYM_SEARCH", error.localizedDescription)
          return
        }
        let found = (response?.mapItems ?? []).map { GymSearchModule.describe($0, from: center) }
        promise.resolve(GymSearchModule.nearestFirst(found))
      }
    }

    // Gyms matching what's typed ("Fit4Less Downtown", "gym near Kitsilano"), near a point when
    // one's given.
    AsyncFunction("search") { (query: String, latitude: Double?, longitude: Double?, promise: Promise) in
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = query
      request.resultTypes = .pointOfInterest
      request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.fitnessCenter])
      var center: CLLocationCoordinate2D?
      if let latitude = latitude, let longitude = longitude {
        let point = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        center = point
        request.region = MKCoordinateRegion(
          center: point,
          latitudinalMeters: 60_000,
          longitudinalMeters: 60_000
        )
      }
      MKLocalSearch(request: request).start { response, error in
        if let error = error {
          promise.reject("E_GYM_SEARCH", error.localizedDescription)
          return
        }
        let found = (response?.mapItems ?? []).map { GymSearchModule.describe($0, from: center) }
        promise.resolve(center == nil ? found : GymSearchModule.nearestFirst(found))
      }
    }
  }

  /** One gym as the app reads it. A value Apple doesn't give is left out, never sent as null. */
  static func describe(_ item: MKMapItem, from center: CLLocationCoordinate2D?) -> [String: Any] {
    let placemark = item.placemark
    let coordinate = placemark.coordinate
    var gym: [String: Any] = [
      "name": item.name ?? "Gym",
      "address": GymSearchModule.address(of: placemark),
      "latitude": coordinate.latitude,
      "longitude": coordinate.longitude,
    ]
    if let center = center {
      let from = CLLocation(latitude: center.latitude, longitude: center.longitude)
      let to = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
      gym["distanceMeters"] = from.distance(from: to)
    }
    if #available(iOS 18.0, *), let identifier = item.identifier?.rawValue {
      gym["placeId"] = identifier
    }
    return gym
  }

  /** "123 Main St, Vancouver, BC": the street, the city and the province or state. */
  static func address(of placemark: MKPlacemark) -> String {
    let street = [placemark.subThoroughfare, placemark.thoroughfare]
      .compactMap { $0 }
      .joined(separator: " ")
    let parts: [String?] = [street, placemark.locality, placemark.administrativeArea]
    return parts.compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
  }

  static func nearestFirst(_ gyms: [[String: Any]]) -> [[String: Any]] {
    return gyms.sorted {
      ($0["distanceMeters"] as? Double ?? .greatestFiniteMagnitude)
        < ($1["distanceMeters"] as? Double ?? .greatestFiniteMagnitude)
    }
  }
}
