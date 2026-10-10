"""Create the iOS privacy manifest after cap add ios; no signing metadata."""
from pathlib import Path
import plistlib
root=Path(__file__).resolve().parents[1]
folder=root/'ios/App/App'
assert folder.is_dir(), 'Run npx cap add ios first'
reasons=[('NSPrivacyAccessedAPICategoryFileTimestamp','C617.1'),('NSPrivacyAccessedAPICategoryUserDefaults','CA92.1')]
payload={'NSPrivacyAccessedAPITypes':[{'NSPrivacyAccessedAPIType':key,'NSPrivacyAccessedAPITypeReasons':[reason]} for key,reason in reasons]}
(folder/'PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps(payload))
project=root/'ios/App/App.xcodeproj/project.pbxproj'
s=project.read_text()
if 'PrivacyInfo.xcprivacy' not in s:
 s=s.replace('/* Begin PBXBuildFile section */','/* Begin PBXBuildFile section */\n\t\tF1A000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = F1A000000000000000000002 /* PrivacyInfo.xcprivacy */; };')
 s=s.replace('/* Begin PBXFileReference section */','/* Begin PBXFileReference section */\n\t\tF1A000000000000000000002 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };')
 # Add next to App Info.plist reference in the App source group, and to resources.
 import re
 s,n=re.subn(r'(/\* App \*/ = \{\n\s+isa = PBXGroup;\n\s+children = \(\n)',r'\1\t\t\t\tF1A000000000000000000002 /* PrivacyInfo.xcprivacy */,\n',s,count=1);assert n==1, 'App group not found'
 s,n=re.subn(r'(isa = PBXResourcesBuildPhase;\n\s+buildActionMask = [^\n]+\n\s+files = \(\n)',r'\1\t\t\t\tF1A000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,\n',s,count=1);assert n==1, 'Resources phase not found'
 project.write_text(s)
print('Privacy manifest created and included in iOS resources')
