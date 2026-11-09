// Sends React Native's next requests down new connections (T-240).
//
// Copied into the app target by withConnectionRenewal.js; ios/ is made anew by
// `expo prebuild`, so the source lives in plugins/.
//
// React Native sends every fetch and XMLHttpRequest through one NSURLSession,
// which RCTHTTPRequestHandler makes and keeps to itself. After the phone
// changes network a connection in its pool may be dead and still look ready:
// iOS hands it the next request, which hears nothing, and on HTTP/2 every
// request to the host after it too (TestFlight 1.0.0 (3), 09.11.2026: two
// Google sign-ins on one dead connection).
//
// `-[NSURLSession flushWithCompletionHandler:]` "ensures that future requests
// occur on a new TCP connection" and leaves requests on their way alone; it
// does not clear cookies or credentials, as `reset` would. To reach the session
// this file notes it as it is made — the one whose delegate is React Native's
// RCTHTTPRequestHandler — and flushes it
//   - whenever iOS says the network path changed (NWPathMonitor), so a request
//     after a change starts on a connection of the new network;
//   - when the app asks (`RehearslyConnections.renew()`, after a request that
//     got no answer: src/shared/services/connections.ts).

#import <Foundation/Foundation.h>
#import <Network/Network.h>
#import <objc/runtime.h>
#import <React/RCTBridgeModule.h>

static NSURLSession *__weak RehearslyReactSession;
static IMP RehearslyOriginalSessionFactory;

static void RehearslyFlush(void (^done)(BOOL flushed))
{
  NSURLSession *session = RehearslyReactSession;
  if (!session) {
    if (done) done(NO);
    return;
  }
  [session flushWithCompletionHandler:^{
    if (done) done(YES);
  }];
}

// A path monitor for the life of the app. Its first update is the path as it
// is now; every later one is a change: another interface, another network,
// lost or found.
static void RehearslyWatchThePath(void)
{
  static nw_path_monitor_t monitor;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    monitor = nw_path_monitor_create();
    __block BOOL first = YES;
    nw_path_monitor_set_queue(monitor, dispatch_queue_create("me.rehearsly.path", DISPATCH_QUEUE_SERIAL));
    nw_path_monitor_set_update_handler(monitor, ^(nw_path_t path) {
      if (first) {
        first = NO;
        return;
      }
      RehearslyFlush(nil);
    });
    nw_path_monitor_start(monitor);
  });
}

static NSURLSession *RehearslySessionFactory(id self, SEL _cmd, NSURLSessionConfiguration *configuration,
                                             id delegate, NSOperationQueue *queue)
{
  NSURLSession *session = ((NSURLSession * (*)(id, SEL, NSURLSessionConfiguration *, id, NSOperationQueue *))
                               RehearslyOriginalSessionFactory)(self, _cmd, configuration, delegate, queue);
  Class reactHandler = NSClassFromString(@"RCTHTTPRequestHandler");
  if (reactHandler && [delegate isKindOfClass:reactHandler]) {
    // A reload in development makes another handler and session: the newest is
    // the one in use.
    RehearslyReactSession = session;
    RehearslyWatchThePath();
  }
  return session;
}

@interface RehearslyConnections : NSObject <RCTBridgeModule>
@end

@implementation RehearslyConnections

RCT_EXPORT_MODULE()

+ (void)load
{
  // Before anything runs: React Native makes its session on the first request.
  Method factory = class_getClassMethod([NSURLSession class], @selector(sessionWithConfiguration:delegate:delegateQueue:));
  RehearslyOriginalSessionFactory = method_setImplementation(factory, (IMP)RehearslySessionFactory);
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

// Resolves whether a pool was flushed: NO before React Native made its
// session, when there is none to flush.
RCT_EXPORT_METHOD(renew : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  RehearslyFlush(^(BOOL flushed) {
    resolve(@(flushed));
  });
}

@end
