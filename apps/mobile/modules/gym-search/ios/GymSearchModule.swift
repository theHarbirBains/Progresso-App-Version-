import CoreLocation
import ExpoModulesCore
import MapKit

// Gyms from Apple Maps, searched on the phone (MapKit): every gym near a point, or those matching
// a name. What's found goes back to the app as plain values -- its name, address, where it is
// and how far from the point given -- and nothing is kept here. The
// point searched from is the phone's own, sent only to Apple's MapKit, never to Progresso.
public class GymSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GymSearch")

    // Every gym within `radiusMeters` of a point, nearest first. Apple Maps files many gyms under
    // other categories, so its fitness centres are searched together with what it finds for
    // "gym", "fitness centre" and "fitness" around the point -- each place once, anything plainly
    // not a gym (a shop, a restaurant, a bank) left out, and nothing further than the radius
    // and a half. One search failing still answers with the rest; all failing is an error.
    AsyncFunction("nearby") { (latitude: Double, longitude: Double, radiusMeters: Double, promise: Promise) in
      let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
      let radius = max(100, min(radiusMeters, 50_000))
      let region = MKCoordinateRegion(
        center: center,
        latitudinalMeters: radius * 2,
        longitudinalMeters: radius * 2
      )
      let categories = MKLocalPointsOfInterestRequest(center: center, radius: radius)
      categories.pointOfInterestFilter = MKPointOfInterestFilter(including: [.fitnessCenter])
      var searches: [MKLocalSearch] = [MKLocalSearch(request: categories)]
      for words in ["gym", "fitness centre", "fitness"] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = words
        request.region = region
        request.resultTypes = .pointOfInterest
        request.pointOfInterestFilter = MKPointOfInterestFilter(excluding: GymSearchModule.notGyms)
        searches.append(MKLocalSearch(request: request))
      }

      let group = DispatchGroup()
      let lock = NSLock()
      var items: [MKMapItem] = []
      var failures = 0
      var lastError: Error?
      for search in searches {
        group.enter()
        search.start { response, error in
          lock.lock()
          if let error = error {
            failures += 1
            lastError = error
          } else {
            items.append(contentsOf: response?.mapItems ?? [])
          }
          lock.unlock()
          group.leave()
        }
      }
      // `searches` is held here until every search has answered.
      group.notify(queue: .main) {
        if failures == searches.count {
          promise.reject("E_GYM_SEARCH", lastError?.localizedDescription ?? "Apple Maps couldn't be searched.")
          return
        }
        let found = GymSearchModule.unique(items)
          .map { GymSearchModule.describe($0, from: center) }
          .filter { ($0["distanceMeters"] as? Double ?? 0) <= radius * 1.5 }
        promise.resolve(GymSearchModule.nearestFirst(found))
      }
    }

    // Gyms matching what's typed ("Fit4Less Downtown", "gym near Kitsilano"), near a point when
    // one's given.
    AsyncFunction("search") { (query: String, latitude: Double?, longitude: Double?, promise: Promise) in
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = query
      request.resultTypes = .pointOfInterest
      // A gym by its name, whatever Apple Maps files it under -- never a shop or a restaurant.
      request.pointOfInterestFilter = MKPointOfInterestFilter(excluding: GymSearchModule.notGyms)
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

  /** What a search for "gym" or "fitness" can turn up that is never one. */
  static let notGyms: [MKPointOfInterestCategory] = [
    .restaurant, .cafe, .bakery, .brewery, .winery, .foodMarket, .store, .pharmacy, .bank, .atm,
    .gasStation, .evCharger, .parking, .hotel, .hospital, .laundry, .carRental, .postOffice,
  ]

  /** Each place once: by its name and where it is (to about 100 m). */
  static func unique(_ items: [MKMapItem]) -> [MKMapItem] {
    var seen = Set<String>()
    var out: [MKMapItem] = []
    for item in items {
      let coordinate = item.placemark.coordinate
      let key = String(
        format: "%@|%.3f|%.3f",
        (item.name ?? "").lowercased(),
        coordinate.latitude,
        coordinate.longitude
      )
      if seen.insert(key).inserted { out.append(item) }
    }
    return out
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
