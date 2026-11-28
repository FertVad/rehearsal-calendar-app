// Tells iOS the app was opened, so an ad network whose ad led to the install
// gets Apple's install postback (T-424).
//
// Copied into the app target by withInstallAttribution.js; ios/ is made anew by
// `expo prebuild`, so the source lives in plugins/.
//
// SKAdNetwork is the system's: the app sends nothing anywhere and reads no
// identifier. Apple keeps the ad's impression, waits out the conversion window
// and sends the postback itself — but only for an advertised app that has
// called one of the update-conversion-value methods (StoreKit's SKAdNetwork.h:
// registerAppForAdNetworkAttribution, "Participating apps should call this on
// launch to complete the install+open action associated with a product view",
// is deprecated in iOS 15.4 for updatePostbackConversionValue:completionHandler:).
// AdAttributionKit (iOS 17.4) is taken to pick up a conversion value set
// through SKAdNetwork, so one framework is enough, and SKAdNetwork reaches the
// app's iOS 15.1 as well.
//
// The value says "installed and opened", nothing more: fine value 0, coarse
// value low, the window left open. The same value on every launch is taken to
// change nothing — the value neither rises nor falls, so no timer restarts and
// no window closes — so the app calls it once per launch (`install`, below)
// instead of keeping a flag of its own; a launch whose call failed is retried
// by the next one. These three points are not yet checked against Apple's
// pages: docs/known-issues.md, T-424.

#import <Foundation/Foundation.h>
#import <StoreKit/StoreKit.h>
#import <React/RCTBridgeModule.h>

@interface RehearslyAttribution : NSObject <RCTBridgeModule>
@end

@implementation RehearslyAttribution

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

// Resolves nil when iOS took the value; rejects with its error, which the app
// only logs. Once per launch: a second call resolves at once and calls nothing.
RCT_EXPORT_METHOD(install : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  static dispatch_once_t once;
  __block BOOL first = NO;
  dispatch_once(&once, ^{
    first = YES;
  });
  if (!first) {
    resolve(nil);
    return;
  }
  void (^done)(NSError *) = ^(NSError *error) {
    if (error) {
      reject(@"attribution", error.localizedDescription, error);
    } else {
      resolve(nil);
    }
  };
  if (@available(iOS 16.1, *)) {
    [SKAdNetwork updatePostbackConversionValue:0
                                   coarseValue:SKAdNetworkCoarseConversionValueLow
                                    lockWindow:NO
                             completionHandler:done];
  } else if (@available(iOS 15.4, *)) {
    [SKAdNetwork updatePostbackConversionValue:0 completionHandler:done];
  } else {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    // iOS 15.1 to 15.3: the only call there is; it reports no error.
    [SKAdNetwork registerAppForAdNetworkAttribution];
#pragma clang diagnostic pop
    resolve(nil);
  }
}

@end
