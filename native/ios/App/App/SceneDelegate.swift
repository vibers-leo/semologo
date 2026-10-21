import UIKit
import Capacitor
import GoogleSignIn

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SemoLogoBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        let remaining = Set(URLContexts.filter { !GIDSignIn.sharedInstance.handle($0.url) })
        if !remaining.isEmpty { SceneDelegateProxy.shared.scene(scene, openURLContexts: remaining) }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Kept in the existing Xcode source file so Capacitor sync cannot drop registration.
class SemoLogoBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SemoGoogleAuthPlugin())
    }
}

@objc(SemoGoogleAuthPlugin)
public class SemoGoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SemoGoogleAuthPlugin"
    public let jsName = "SemoGoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]
    private var signingIn = false

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.bridge?.viewController else {
                call.reject("Sign-in is unavailable", "auth/native-unavailable"); return
            }
            // Only our HTTPS application may invoke this credential bridge.
            guard let url = self.bridge?.webView?.url,
                  url.scheme == "https", url.host == "semologo.com" else {
                call.reject("Untrusted origin", "auth/native-origin"); return
            }
            guard !self.signingIn else {
                call.reject("Sign-in already running", "auth/cancelled-popup-request"); return
            }
            self.signingIn = true
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
                self.signingIn = false
                if let error = error as NSError? {
                    call.reject("Google sign-in did not complete",
                                error.code == -5 ? "auth/popup-closed-by-user" : "auth/native-failed")
                    return
                }
                guard let token = result?.user.idToken?.tokenString else {
                    call.reject("No identity token", "auth/native-failed"); return
                }
                // Return over the local Capacitor bridge; never put tokens in URLs or logs.
                call.resolve(["idToken": token])
            }
        }
    }
}
