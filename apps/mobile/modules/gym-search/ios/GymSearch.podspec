Pod::Spec.new do |s|
  s.name           = 'GymSearch'
  s.version        = '1.0.0'
  s.summary        = 'Finds gyms with Apple Maps, for Progresso.'
  s.description    = 'Searches Apple Maps (MapKit) for gyms near a point, or by name, on the phone.'
  s.author         = 'Progresso'
  s.homepage       = 'https://progresso.app'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'MapKit', 'CoreLocation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
